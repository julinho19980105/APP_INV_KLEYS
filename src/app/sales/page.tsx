
"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { 
  Ban, 
  MoreVertical,
  Check,
  X,
  Edit2,
  Image as ImageIcon,
  ShoppingBag,
  Loader2,
  Plus,
  Printer,
  Bluetooth,
  BluetoothConnected,
  Search
} from "lucide-react"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { useCollection, useFirestore, useDoc } from "@/firebase"
import { collection, query, orderBy, doc, updateDoc, increment, addDoc, serverTimestamp } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { toJpeg } from 'html-to-image'
import { format } from "date-fns"
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'

export default function SalesPage() {
  const router = useRouter()
  const db = useFirestore()
  const { toast } = useToast()
  
  const [searchQuery, setSearchQuery] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<string>("active")
  const [confirmAnnulId, setConfirmAnnulId] = React.useState<string | null>(null)
  const [activeReceipt, setActiveReceipt] = React.useState<any>(null)
  const [isPrinting, setIsPrinting] = React.useState(false)
  
  const [bleDevice, setBleDevice] = React.useState<any>(null)
  const [printCharacteristic, setPrintCharacteristic] = React.useState<any>(null)

  const receiptRef = React.useRef<HTMLDivElement>(null)
  
  const configDocRef = React.useMemo(() => db ? doc(db, "config", "global") : null, [db])
  const { data: companySettings } = useDoc(configDocRef)
  const brandColor = companySettings?.brandColor || "#FF3399"
  const printerWidth = companySettings?.printerWidth || "80"

  // Simplificamos la consulta para evitar errores de índices en el prototipo
  const quotesRef = React.useMemo(() => {
    if (!db) return null
    return query(
      collection(db, "quotes"), 
      orderBy("createdAt", "desc")
    )
  }, [db])

  const { data: quotes = [], loading } = useCollection(quotesRef)

  const monthTotal = React.useMemo(() => {
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()
    
    return quotes
      .filter(q => {
        if (q.status === 'annulled' || !q.createdAt?.toDate) return false
        const date = q.createdAt.toDate()
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear
      })
      .reduce((acc, q) => acc + (q.total || 0), 0)
  }, [quotes])

  const filteredQuotes = React.useMemo(() => {
    const q = searchQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    return quotes.filter(s => {
      const matchesSearch = s.id.toLowerCase().includes(q) || s.customerName?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q)
      
      let matchesStatus = false
      if (statusFilter === "all") matchesStatus = true
      else if (statusFilter === "active") matchesStatus = s.status === "active" || s.status === "shipped"
      else matchesStatus = s.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [quotes, searchQuery, statusFilter])

  const groupedSales = React.useMemo(() => {
    const groups: Record<string, { dateLabel: string, sales: any[], dayTotal: number }> = {}
    filteredQuotes.forEach(sale => {
      const date = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date()
      const dayLabel = date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()
      if (!groups[dayLabel]) groups[dayLabel] = { dateLabel: dayLabel, sales: [], dayTotal: 0 }
      groups[dayLabel].sales.push(sale)
      if (sale.status !== 'annulled') groups[dayLabel].dayTotal += (sale.total || 0)
    })
    return Object.values(groups)
  }, [filteredQuotes])

  const connectPrinter = async () => {
    try {
      const device = await (navigator as any).bluetooth.requestDevice({
        filters: [
          { services: ['000018f0-0000-1000-8000-00805f9b34fb'] },
          { namePrefix: 'Printer' }
        ],
        optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
      })
      
      const server = await device.gatt?.connect()
      const services = await server?.getPrimaryServices()
      if (!services || services.length === 0) throw new Error("No services found")
      
      let foundCharacteristic = null
      for (const service of services) {
        try {
          const characteristics = await service.getCharacteristics()
          const writeChar = characteristics.find((c: any) => c.properties.write || c.properties.writeWithoutResponse)
          if (writeChar) { foundCharacteristic = writeChar; break; }
        } catch (e) { continue; }
      }
      
      if (!foundCharacteristic) throw new Error("No characteristic found")
      
      setBleDevice(device)
      setPrintCharacteristic(foundCharacteristic)
      toast({ title: "Impresora Conectada" })
      
      device.addEventListener('gattserverdisconnected', () => {
        setBleDevice(null)
        setPrintCharacteristic(null)
        toast({ variant: "destructive", title: "Impresora Desconectada" })
      })
    } catch (e) {
      toast({ variant: "destructive", title: "Error conexión Bluetooth" })
    }
  }

  const sendEscPos = async (data: Uint8Array) => {
    if (!printCharacteristic) return
    const chunkSize = 20
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize)
      await printCharacteristic.writeValue(chunk)
    }
  }

  const handleBluetoothPrint = async (sale: any) => {
    if (!printCharacteristic) {
      await connectPrinter()
      if (!printCharacteristic) return
    }
    setIsPrinting(true)
    const encoder = new TextEncoder()
    const esc = {
      init: new Uint8Array([0x1b, 0x40]),
      center: new Uint8Array([0x1b, 0x61, 0x01]),
      left: new Uint8Array([0x1b, 0x61, 0x00]),
      right: new Uint8Array([0x1b, 0x61, 0x02]),
      boldOn: new Uint8Array([0x1b, 0x45, 0x01]),
      boldOff: new Uint8Array([0x1b, 0x45, 0x00]),
      tripleSize: new Uint8Array([0x1d, 0x21, 0x22]), 
      normalSize: new Uint8Array([0x1d, 0x21, 0x00]),
      feed: new Uint8Array([0x0a, 0x0a, 0x0a]),
      cut: new Uint8Array([0x1d, 0x56, 0x41, 0x03])
    }

    try {
      const charWidth = printerWidth === "58" ? 32 : 48
      const separator = "-".repeat(charWidth) + "\n"
      let commands = new Uint8Array([
        ...esc.init,
        ...esc.center,
        ...esc.tripleSize,
        ...esc.boldOn,
        ...encoder.encode((companySettings?.companyName || "STILOSTACK").toUpperCase() + "\n"),
        ...esc.normalSize,
        ...esc.boldOff,
        ...encoder.encode("BOLETA INTERNA\n"),
        ...encoder.encode(`${sale.id}\n`),
        ...encoder.encode(separator),
        ...esc.left
      ])

      const dateStr = format(sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date(), "dd/MM/yy HH:mm")
      commands = new Uint8Array([
        ...commands,
        ...esc.boldOn,
        ...encoder.encode(`CLIENTE: ${sale.customerName.toUpperCase()}\n`),
        ...encoder.encode(`FECHA: ${dateStr}\n`),
        ...esc.boldOff,
        ...encoder.encode(separator)
      ])

      let totalQty = 0
      for (const item of sale.items) {
        const qty = Number(item.quantity)
        totalQty += qty
        const sub = ((Number(item.price) * qty) - (Number(item.discount) || 0)).toFixed(2)
        commands = new Uint8Array([
          ...commands,
          ...encoder.encode(`${item.name.substring(0, charWidth)}\n`),
          ...encoder.encode(`${qty} x S/ ${item.price} = S/ ${sub}\n`)
        ])
      }

      commands = new Uint8Array([
        ...commands,
        ...encoder.encode(separator),
        ...esc.right,
        ...esc.normalSize,
        ...esc.boldOn,
        ...encoder.encode(`CANT. TOTAL: ${totalQty} UND\n`),
        ...encoder.encode(`MONTO NETO: S/ ${Number(sale.total).toFixed(2)}\n`),
        ...esc.tripleSize,
        ...encoder.encode(`TOTAL: S/ ${Number(sale.total).toFixed(2)}\n`),
        ...esc.normalSize,
        ...esc.boldOff,
        ...esc.feed,
        ...esc.cut
      ])

      await sendEscPos(commands)
      toast({ title: "Ticket Impreso" })
    } catch (e) {
      toast({ variant: "destructive", title: "Error al imprimir" })
    } finally {
      setIsPrinting(false)
    }
  }

  const handleSendImage = async (sale: any) => {
    setActiveReceipt(sale)
    setTimeout(async () => {
      if (receiptRef.current) {
        try {
          const dataUrl = await toJpeg(receiptRef.current, { quality: 1, backgroundColor: '#ffffff', pixelRatio: 2 })
          const blob = await (await fetch(dataUrl)).blob()
          const file = new File([blob], `Boleta_${sale.id}.jpg`, { type: 'image/jpeg' })
          if (navigator.share) await navigator.share({ files: [file] })
          else {
            const link = document.createElement('a')
            link.download = `Boleta_${sale.id}.jpg`; link.href = dataUrl; link.click()
          }
        } catch (err) { toast({ variant: "destructive", title: "Error imagen" }) }
      }
    }, 500)
  }

  const annulQuote = async (quote: any) => {
    if (!db) return
    try {
      await updateDoc(doc(db, "quotes", quote.id), { status: 'annulled' })
      
      for (const item of quote.items) {
        if (item.isRegistered && item.productId !== "MANUAL") {
          const prodRef = doc(db, "products", item.productId)
          updateDoc(prodRef, {
            stock: increment(Number(item.quantity)),
            updatedAt: serverTimestamp()
          }).catch(async () => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: prodRef.path, operation: 'update' }));
          });

          addDoc(collection(db, "movements"), {
            productCode: item.productId,
            type: "return",
            quantity: Number(item.quantity),
            reason: `ANULACIÓN BOLETA ${quote.id}`,
            timestamp: serverTimestamp(),
            referenceId: quote.id
          }).catch(async () => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'movements', operation: 'create' }));
          });
        }
      }
      toast({ title: "BOLETA ANULADA Y STOCK DEVUELTO" })
      setConfirmAnnulId(null)
    } catch (e) { toast({ variant: "destructive", title: "Error al anular" }) }
  }

  return (
    <div className="space-y-6 pt-2 pb-32 max-w-4xl mx-auto px-2 md:px-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-primary/10 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-primary/20" style={{ backgroundColor: brandColor }}>
            <ShoppingBag className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-[9px] font-black text-primary uppercase tracking-[0.2em] mb-0.5">Total Mes Actual</h1>
            <div className="font-headline font-black text-xl md:text-2xl text-foreground tracking-tighter">
              S/ {monthTotal.toFixed(2)}
            </div>
          </div>
        </div>
        <div className="flex w-full md:w-auto gap-2">
          <Button 
            variant="outline"
            className={cn("h-10 px-4 rounded-xl border-primary/10 font-black text-[9px] uppercase gap-2 bg-white", bleDevice && "text-green-600 border-green-200 bg-green-50")}
            onClick={connectPrinter}
          >
            {bleDevice ? <BluetoothConnected className="w-4 h-4" /> : <Bluetooth className="w-4 h-4" />}
            {bleDevice ? "Lista" : "Conectar"}
          </Button>
          <div className="relative flex-1 md:w-48">
            <Search className="absolute left-3 top-3 h-4 w-4 text-primary/40" />
            <Input 
              placeholder="" 
              className="pl-9 h-10 rounded-xl border-primary/10 font-black text-[11px] uppercase bg-white shadow-sm"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[110px] h-10 rounded-xl border-primary/10 font-black text-[9px] uppercase bg-white">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all" className="text-[9px] font-black uppercase">Todos</SelectItem>
              <SelectItem value="active" className="text-[9px] font-black uppercase">Ventas</SelectItem>
              <SelectItem value="annulled" className="text-[9px] font-black uppercase">Anulados</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-6">
        {loading && (
          <div className="flex flex-col items-center justify-center py-10 gap-3 opacity-30">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="text-[8px] font-black uppercase tracking-widest">Consultando...</span>
          </div>
        )}

        {groupedSales.map(group => (
          <div key={group.dateLabel} className="space-y-2">
            <div className="flex justify-between items-center px-4 py-1.5 text-white rounded-lg shadow-sm" style={{ backgroundColor: brandColor }}>
              <span className="text-[9px] font-black uppercase tracking-widest">{group.dateLabel}</span>
              <span className="font-headline font-black text-sm">S/ {group.dayTotal.toFixed(2)}</span>
            </div>
            
            <div className="space-y-1.5">
              {group.sales.map(s => (
                <Card key={s.id} className={cn(
                  "rounded-xl border border-primary/5 overflow-hidden transition-all",
                  s.status === 'annulled' ? "opacity-30 bg-secondary/30" : "bg-white shadow-sm hover:shadow-md"
                )}>
                  <CardContent className="p-2.5 flex items-center justify-between">
                    <div className="flex-1 space-y-0.5">
                      <div className="flex justify-between items-center pr-2">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-[10px] text-foreground uppercase tracking-wide">{s.id}</span>
                          <Badge variant="outline" className={cn("text-[7px] font-black h-4 px-2 uppercase border-none rounded-md", s.status !== 'annulled' ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600")}>
                            {s.status === 'annulled' ? 'ANULADO' : s.status === 'shipped' ? 'ENVIADO' : 'VENTA'}
                          </Badge>
                        </div>
                        <span className="font-headline font-medium text-[11px] text-foreground">S/ {Number(s.total).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center pr-2">
                        <span className="text-[10px] font-normal text-foreground uppercase truncate max-w-[140px]">{s.customerName}</span>
                        <span className="text-[8px] font-medium text-muted-foreground uppercase bg-secondary px-1.5 py-0.5 rounded">
                          {s.items?.reduce((acc: number, item: any) => acc + (Number(item.quantity) || 0), 0)} UND
                        </span>
                      </div>
                    </div>

                    <div className="relative">
                      {confirmAnnulId === s.id ? (
                        <div className="flex gap-1">
                          <Button size="icon" className="h-8 w-8 bg-destructive text-white rounded-lg" onClick={() => annulQuote(s)}><Check className="w-4 h-4" /></Button>
                          <Button size="icon" className="h-8 w-8 bg-secondary text-primary rounded-lg" onClick={() => setConfirmAnnulId(null)}><X className="w-4 h-4" /></Button>
                        </div>
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-primary/5">
                              <MoreVertical className="w-4 h-4 text-primary" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl p-1.5 w-56 shadow-xl">
                            <DropdownMenuItem className="text-[10px] font-black uppercase gap-2.5 p-2.5 rounded-lg" onClick={() => router.push(`/quotes?edit=${s.id}`)}>
                              <Edit2 className="w-3.5 h-3.5" style={{ color: brandColor }} /> Editar Venta
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-[10px] font-black uppercase gap-2.5 p-2.5 rounded-lg" onClick={() => handleBluetoothPrint(s)} disabled={isPrinting}>
                              <Printer className="w-3.5 h-3.5" style={{ color: brandColor }} /> Imprimir Ticket
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-[10px] font-black uppercase gap-2.5 p-2.5 rounded-lg" onClick={() => handleSendImage(s)}>
                              <ImageIcon className="w-3.5 h-3.5" style={{ color: brandColor }} /> Compartir Imagen
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-[10px] font-black uppercase gap-2.5 p-2.5 rounded-lg text-destructive" onClick={() => setConfirmAnnulId(s.id)}>
                              <Ban className="w-3.5 h-3.5" /> Anular Boleta
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <Button onClick={() => router.push('/quotes')} className="h-20 w-20 rounded-full shadow-2xl flex flex-col gap-1 items-center justify-center text-white active:scale-90 transition-transform" style={{ backgroundColor: brandColor }}>
          <Plus className="w-8 h-8" />
          <span className="text-[9px] font-black uppercase">COTIZACIÓN</span>
        </Button>
      </div>

      <div className="fixed -left-[8000px] top-0">
        {activeReceipt && (
          <div ref={receiptRef} className="bg-white p-12 w-[800px] text-black font-sans relative">
            <div className="border-t-[6px] mb-2" style={{ borderColor: brandColor }}></div>
            <div className="text-center mb-6">
              <h1 className="text-7xl font-black uppercase tracking-tighter" style={{ color: brandColor }}>{companySettings?.companyName || "STILOSTACK"}</h1>
              <div className="text-xl font-black text-black/40 mt-2 tracking-[0.5em]">BOLETA INTERNA</div>
              <div className="text-4xl font-black text-black mt-2">{activeReceipt.id}</div>
            </div>
            <div className="grid grid-cols-2 gap-12 mb-10 px-4">
              <div>
                <div className="text-lg font-black text-black/30 uppercase tracking-[0.2em]">CLIENTE</div>
                <div className="text-3xl font-black uppercase leading-tight">{activeReceipt.customerName}</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-black text-black/30 uppercase tracking-[0.2em]">FECHA</div>
                <div className="text-3xl font-black">{activeReceipt.createdAt?.toDate ? format(activeReceipt.createdAt.toDate(), "dd/MM/yyyy") : ""}</div>
              </div>
            </div>
            <table className="w-full text-left mb-10">
              <thead className="text-[14px] font-black uppercase text-white" style={{ backgroundColor: brandColor }}>
                <tr>
                  <th className="py-4 px-6 rounded-l-2xl">PRENDA</th>
                  <th className="py-4 text-center">P. UNIT</th>
                  <th className="py-4 text-center">CANT</th>
                  <th className="py-4 text-center">DESC</th>
                  <th className="py-4 text-right pr-8 rounded-r-2xl">SUBTOTAL</th>
                </tr>
              </thead>
              <tbody className="text-lg font-medium uppercase">
                {activeReceipt.items?.map((item: any, i: number) => {
                  const sub = (Number(item.price) * Number(item.quantity)) - (Number(item.discount) || 0)
                  return (
                    <tr key={i} className="border-b border-black/5">
                      <td className="py-6 px-6"><div className="font-black text-xl">{item.name}</div>{item.description && <div className="text-sm text-black/50 italic">{item.description}</div>}</td>
                      <td className="py-6 text-center font-black">S/ {item.price}</td>
                      <td className="py-6 text-center font-black">{item.quantity}</td>
                      <td className="py-6 text-center text-destructive font-black">S/ {item.discount || 0}</td>
                      <td className="py-6 text-right pr-8 font-black text-xl">S/ {sub.toFixed(2)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="flex flex-col items-end px-6 gap-2">
              <div className="text-xl font-black text-black/40">CANTIDAD TOTAL: {activeReceipt.items?.reduce((acc: number, i: any) => acc + (Number(i.quantity) || 0), 0)} UND</div>
              <div className="text-6xl font-black" style={{ color: brandColor }}>TOTAL S/ {Number(activeReceipt.total).toFixed(2)}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
