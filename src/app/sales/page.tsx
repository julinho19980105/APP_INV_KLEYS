
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
  Search, 
  Ban, 
  MoreVertical,
  Check,
  X,
  Edit2,
  Image as ImageIcon,
  ShoppingBag,
  History,
  Loader2,
  Users,
  Plus,
  Printer,
  Bluetooth,
  BluetoothConnected
} from "lucide-react"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { useCollection, useFirestore, useDoc } from "@/firebase"
import { collection, query, orderBy, doc, updateDoc, increment, addDoc, serverTimestamp, where } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { toJpeg } from 'html-to-image'
import { format } from "date-fns"

export default function SalesPage() {
  const router = useRouter()
  const db = useFirestore()
  const { toast } = useToast()
  
  const [searchQuery, setSearchQuery] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<string>("active")
  const [confirmAnnulId, setConfirmAnnulId] = React.useState<string | null>(null)
  const [activeReceipt, setActiveReceipt] = React.useState<any>(null)
  const [daysLimit, setDaysLimit] = React.useState(30)
  const [isPrinting, setIsPrinting] = React.useState(false)
  
  // Bluetooth State
  const [bleDevice, setBleDevice] = React.useState<BluetoothDevice | null>(null)
  const [printCharacteristic, setPrintCharacteristic] = React.useState<BluetoothRemoteGATTCharacteristic | null>(null)

  const receiptRef = React.useRef<HTMLDivElement>(null)
  
  const configDocRef = React.useMemo(() => db ? doc(db, "config", "global") : null, [db])
  const { data: companySettings } = useDoc(configDocRef)
  const brandColor = companySettings?.brandColor || "#FF3399"
  const printerWidth = companySettings?.printerWidth || "80"

  const quotesRef = React.useMemo(() => {
    if (!db) return null
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - daysLimit)
    
    return query(
      collection(db, "quotes"), 
      where("createdAt", ">=", startDate),
      orderBy("createdAt", "desc")
    )
  }, [db, daysLimit])

  const { data: quotes = [], loading } = useCollection(quotesRef)

  const monthTotal = React.useMemo(() => {
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()
    
    return quotes
      .filter(q => {
        if (q.status !== 'active' || !q.createdAt?.toDate) return false
        const date = q.createdAt.toDate()
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear
      })
      .reduce((acc, q) => acc + (q.total || 0), 0)
  }, [quotes])

  const filteredQuotes = React.useMemo(() => {
    const q = searchQuery.toLowerCase()
    return quotes.filter(s => {
      const matchesSearch = s.id.toLowerCase().includes(q) || s.customerName?.toLowerCase().includes(q)
      const matchesStatus = statusFilter === "all" || s.status === statusFilter
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
      if (sale.status === 'active') groups[dayLabel].dayTotal += (sale.total || 0)
    })
    return Object.values(groups)
  }, [filteredQuotes])

  // Bluetooth Connection Logic
  const connectPrinter = async () => {
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb', '0000ff00-0000-1000-8000-00805f9b34fb'] }],
        optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', '0000ff00-0000-1000-8000-00805f9b34fb']
      })
      
      const server = await device.gatt?.connect()
      const services = await server?.getPrimaryServices()
      if (!services || services.length === 0) throw new Error("No se encontraron servicios de impresión")
      
      const characteristics = await services[0].getCharacteristics()
      const writeChar = characteristics.find(c => c.properties.write || c.properties.writeWithoutResponse)
      
      if (!writeChar) throw new Error("No se encontró característica de escritura")
      
      setBleDevice(device)
      setPrintCharacteristic(writeChar)
      toast({ title: "Impresora Conectada" })
      
      device.addEventListener('gattserverdisconnected', () => {
        setBleDevice(null)
        setPrintCharacteristic(null)
        toast({ variant: "destructive", title: "Impresora Desconectada" })
      })
    } catch (e) {
      console.error(e)
      toast({ variant: "destructive", title: "Error al conectar impresora Bluetooth" })
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
      feed: new Uint8Array([0x0a, 0x0a, 0x0a]),
      cut: new Uint8Array([0x1d, 0x56, 0x41, 0x03])
    }

    try {
      const charWidth = printerWidth === "58" ? 32 : 48
      const separator = "-".repeat(charWidth) + "\n"
      
      let commands = new Uint8Array([
        ...esc.init,
        ...esc.center,
        ...esc.boldOn,
        ...encoder.encode((companySettings?.companyName || "STILOSTACK").toUpperCase() + "\n"),
        ...esc.boldOff,
        ...encoder.encode(separator),
        ...esc.left,
        ...encoder.encode(`ID: ${sale.id}\n`),
        ...encoder.encode(`FECHA: ${format(sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date(), "dd/MM/yy HH:mm")}\n`),
        ...encoder.encode(`CLIENTE: ${sale.customerName.toUpperCase()}\n`),
        ...encoder.encode(separator),
        ...esc.boldOn,
        ...encoder.encode(`PRENDA           CANT  P.U   TOTAL\n`),
        ...esc.boldOff,
        ...encoder.encode(separator)
      ])

      for (const item of sale.items) {
        const subtotal = (Number(item.price) * Number(item.quantity)) - (Number(item.discount) || 0)
        const namePart = (item.name.substring(0, 16).padEnd(16))
        const qtyPart = (item.quantity.toString().padStart(4))
        const pricePart = (Number(item.price).toFixed(1).padStart(6))
        const totalPart = (subtotal.toFixed(1).padStart(8))
        
        commands = new Uint8Array([
          ...commands,
          ...encoder.encode(`${namePart}${qtyPart}${pricePart}${totalPart}\n`)
        ])
        
        if (Number(item.discount) > 0) {
          commands = new Uint8Array([
            ...commands,
            ...encoder.encode(`  DESC: -S/ ${Number(item.discount).toFixed(1)}\n`)
          ])
        }
      }

      const totalUnits = (sale.items || []).reduce((acc: number, i: any) => acc + (Number(i.quantity) || 0), 0)

      commands = new Uint8Array([
        ...commands,
        ...encoder.encode(separator),
        ...esc.right,
        ...encoder.encode(`UNIDADES: ${totalUnits}\n`),
        ...esc.boldOn,
        ...encoder.encode(`TOTAL: S/ ${Number(sale.total).toFixed(2)}\n`),
        ...esc.boldOff,
        ...esc.center,
        ...encoder.encode("\nGRACIAS POR SU PREFERENCIA\n"),
        ...esc.feed,
        ...esc.cut
      ])

      await sendEscPos(commands)
      toast({ title: "Ticket Impreso" })
    } catch (e) {
      console.error(e)
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
          const dataUrl = await toJpeg(receiptRef.current, { 
            quality: 0.95, 
            backgroundColor: '#ffffff',
            pixelRatio: 2
          })
          const blob = await (await fetch(dataUrl)).blob()
          const file = new File([blob], `Boleta_${sale.id}.jpg`, { type: 'image/jpeg' })
          if (navigator.share) {
            await navigator.share({ files: [file], title: `Boleta ${sale.id}` })
          } else {
            const link = document.createElement('a')
            link.download = `Boleta_${sale.id}.jpg`
            link.href = dataUrl
            link.click()
          }
        } catch (err) { toast({ variant: "destructive", title: "ERROR AL GENERAR IMAGEN" }) }
      }
    }, 500)
  }

  const annulQuote = async (quote: any) => {
    if (!db) return
    try {
      await updateDoc(doc(db, "quotes", quote.id), { status: 'annulled' })
      for (const item of quote.items) {
        if (item.isRegistered && item.productId !== "MANUAL") {
          await updateDoc(doc(db, "products", item.productId), { stock: increment(item.quantity) })
          await addDoc(collection(db, "movements"), {
            productCode: item.productId,
            type: "return",
            quantity: item.quantity,
            reason: `ANULACIÓN BOLETA ${quote.id}`,
            timestamp: serverTimestamp()
          })
        }
      }
      toast({ title: "BOLETA ANULADA" })
      setConfirmAnnulId(null)
    } catch (e) { toast({ variant: "destructive", title: "ERROR" }) }
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
            className={cn(
              "h-10 px-4 rounded-xl border-primary/10 font-black text-[9px] uppercase gap-2 bg-white",
              bleDevice ? "text-green-600 border-green-200 bg-green-50" : "text-primary"
            )}
            onClick={connectPrinter}
          >
            {bleDevice ? <BluetoothConnected className="w-4 h-4" /> : <Bluetooth className="w-4 h-4" />}
            {bleDevice ? "Impresora Lista" : "Conectar BLE"}
          </Button>
          <div className="relative flex-1 md:w-48">
            <Search className="absolute left-3 top-3 h-4 w-4" style={{ color: brandColor }} />
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
          <Button 
            variant="outline"
            className="h-10 px-4 rounded-xl border-primary/10 font-black text-[9px] uppercase gap-2 bg-white"
            onClick={() => router.push('/customers')}
          >
            <Users className="w-3.5 h-3.5" style={{ color: brandColor }} />
            Clientes
          </Button>
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
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-[7px] font-black h-4 px-2 uppercase border-none rounded-md", 
                              s.status === 'active' ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                            )}
                          >
                            {s.status === 'active' ? 'VENTA' : 'ANULADO'}
                          </Badge>
                        </div>
                        <span className="font-headline font-medium text-[11px] text-foreground">S/ {Number(s.total).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center pr-2">
                        <span className="text-[10px] font-normal text-foreground uppercase truncate max-w-[140px]">
                          {s.customerName}
                        </span>
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
                            <DropdownMenuItem 
                              className="text-[10px] font-black uppercase gap-2.5 p-2.5 rounded-lg" 
                              onClick={() => handleBluetoothPrint(s)}
                              disabled={isPrinting}
                            >
                              <Printer className="w-3.5 h-3.5" style={{ color: brandColor }} /> {isPrinting ? "Imprimiendo..." : "Imprimir Ticket BLE"}
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

        {!loading && (
          <div className="flex justify-center pt-4 pb-8">
            <Button 
              variant="outline" 
              className="h-9 rounded-xl border-primary/20 text-primary font-black uppercase text-[8px] tracking-[0.2em] px-6 shadow-sm"
              onClick={() => setDaysLimit(prev => prev + 30)}
            >
              <History className="w-3 h-3 mr-2" /> Cargar 30 días anteriores
            </Button>
          </div>
        )}
      </div>

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <Button 
          onClick={() => router.push('/quotes')}
          className="h-20 w-20 rounded-full shadow-2xl flex flex-col gap-1 items-center justify-center text-white active:scale-90 transition-transform"
          style={{ backgroundColor: brandColor }}
        >
          <Plus className="w-8 h-8" />
          <span className="text-[9px] font-black uppercase">COTIZACIÓN</span>
        </Button>
      </div>

      {/* Plantilla para Compartir Imagen / Vista Previa */}
      <div className="fixed -left-[8000px] top-0">
        {activeReceipt && (
          <div 
            ref={receiptRef} 
            className={cn(
              "bg-white p-6 text-black font-mono text-[10px] leading-tight",
              printerWidth === "58" ? "w-[58mm]" : "w-[80mm]"
            )}
          >
            <div className="text-center mb-6 border-y-2 py-4" style={{ borderColor: brandColor }}>
              <h1 className="text-sm font-black uppercase tracking-widest" style={{ color: brandColor }}>
                {companySettings?.companyName || "STILOSTACK"}
              </h1>
            </div>
            
            <div className="flex justify-between items-start mb-6">
              <div className="space-y-0.5">
                <span className="text-[8px] font-bold text-black/50 block">CLIENTE:</span>
                <div className="text-[12px] font-black uppercase">{activeReceipt.customerName}</div>
                <div className="text-[9px] font-medium text-black/50">{activeReceipt.customerId}</div>
              </div>
              <div className="text-right">
                <div className="text-[14px] font-black mb-0.5" style={{ color: brandColor }}>{activeReceipt.id}</div>
                <div className="text-[9px] font-bold text-black/60">
                  {activeReceipt.createdAt?.toDate ? format(activeReceipt.createdAt.toDate(), "dd/MM/yy HH:mm") : ""}
                </div>
              </div>
            </div>

            <div className="w-full border-y border-black/10 py-3 mb-6">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[9px] font-black uppercase border-b border-black/5">
                    <th className="pb-2">N</th>
                    <th className="pb-2">PRENDA</th>
                    <th className="pb-2 text-center">P.U.</th>
                    <th className="pb-2 text-center">CANT</th>
                    <th className="pb-2 text-right">TOTAL</th>
                  </tr>
                </thead>
                <tbody className="text-[9px] font-medium uppercase">
                  {activeReceipt.items?.map((item: any, i: number) => (
                    <tr key={i} className="align-top border-b border-black/5 last:border-0">
                      <td className="py-2 text-black/40">{i + 1}</td>
                      <td className="py-2">
                        <div className="font-bold text-black">{item.name}</div>
                        {item.description && <div className="text-[8px] text-black/40 italic leading-none mt-1">{item.description}</div>}
                        {Number(item.discount) > 0 && (
                          <div className="text-[8px] font-black text-destructive mt-1 uppercase tracking-tighter">
                            DESC: -S/ {Number(item.discount).toFixed(1)}
                          </div>
                        )}
                      </td>
                      <td className="py-2 text-center">{Number(item.price).toFixed(1)}</td>
                      <td className="py-2 text-center font-black">{item.quantity}</td>
                      <td className="py-2 text-right font-black">
                        {((Number(item.price) * Number(item.quantity)) - (Number(item.discount) || 0)).toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-2 border-t border-dashed border-black/20 pt-4">
              <div className="flex justify-between items-end">
                <div className="text-[10px] font-black uppercase">
                  TOTAL PRENDAS: {(activeReceipt.items || []).reduce((acc: number, item: any) => acc + (Number(item.quantity) || 0), 0)}
                </div>
                <div className="text-right space-y-0.5">
                  <div className="text-[8px] font-black text-black/40 uppercase">TOTAL NETO:</div>
                  <div className="text-[24px] font-black leading-none" style={{ color: brandColor }}>
                    S/. {Number(activeReceipt.total).toFixed(1)}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-10 text-center border-t border-black/5 pt-6">
              <span className="text-[8px] font-bold text-black/30 uppercase tracking-[0.4em]">
                GRACIAS POR SU PREFERENCIA
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
