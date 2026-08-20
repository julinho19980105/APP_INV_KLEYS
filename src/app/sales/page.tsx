
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
  Printer, 
  MoreVertical,
  Check,
  X,
  Edit2,
  Image as ImageIcon,
  Bluetooth,
  FileText
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

export default function SalesPage() {
  const router = useRouter()
  const db = useFirestore()
  const { toast } = useToast()
  
  const [searchQuery, setSearchQuery] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<string>("active")
  const [confirmAnnulId, setConfirmAnnulId] = React.useState<string | null>(null)
  const [bleDevice, setBleDevice] = React.useState<BluetoothDevice | null>(null)
  const [bleCharacteristic, setBleCharacteristic] = React.useState<BluetoothRemoteGATTCharacteristic | null>(null)
  const receiptRef = React.useRef<HTMLDivElement>(null)
  const [activeReceipt, setActiveReceipt] = React.useState<any>(null)
  
  const configDocRef = React.useMemo(() => db ? doc(db, "config", "global") : null, [db])
  const { data: companySettings } = useDoc(configDocRef)

  const quotesRef = React.useMemo(() => db ? query(collection(db, "quotes"), orderBy("createdAt", "desc")) : null, [db])
  const { data: quotes = [] } = useCollection(quotesRef)

  const currentMonthTotal = React.useMemo(() => {
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()
    
    return quotes
      .filter(q => {
        const date = q.createdAt?.toDate ? q.createdAt.toDate() : new Date()
        const isThisMonth = date.getMonth() === currentMonth && date.getFullYear() === currentYear
        const isValidStatus = q.status === 'active' || q.status === 'shipped'
        return isThisMonth && isValidStatus
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
      if (sale.status !== 'annulled') groups[dayLabel].dayTotal += (sale.total || 0)
    })
    return Object.values(groups)
  }, [filteredQuotes])

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
    } catch (e) {
      toast({ variant: "destructive", title: "ERROR" })
    }
  }

  const sanitize = (text: string) => {
    return text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/ñ/g, "n")
      .replace(/Ñ/g, "N")
  }

  const padLine = (left: string, right: string, width: number) => {
    const spaces = width - (left.length + right.length);
    return left + " ".repeat(Math.max(1, spaces)) + right;
  }

  const handlePrintBLE = async (sale: any) => {
    if (!bleDevice || !bleCharacteristic) {
      try {
        toast({ title: "BUSCANDO IMPRESORA..." })
        const device = await (navigator as any).bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', '0000ff00-0000-1000-8000-00805f9b34fb']
        })
        
        const server = await device.gatt.connect()
        const services = await server.getPrimaryServices()
        let char = null
        for (const service of services) {
          const characteristics = await service.getCharacteristics()
          char = characteristics.find((c: any) => c.properties.write || c.properties.writeWithoutResponse)
          if (char) break
        }

        if (char) {
          setBleDevice(device)
          setBleCharacteristic(char)
          toast({ title: "IMPRESORA CONECTADA", description: "PULSE IMPRIMIR OTRA VEZ." })
        } else {
          toast({ variant: "destructive", title: "IMPRESORA NO COMPATIBLE" })
        }
      } catch (e) {
        toast({ variant: "destructive", title: "ERROR DE CONEXIÓN" })
      }
      return
    }

    try {
      toast({ title: "GENERANDO TICKET..." })
      const companyName = companySettings?.companyName || "DIVA INDUSTRIAL";
      const printerWidth = parseInt(companySettings?.printerWidth || "80");
      const charLimit = printerWidth === 80 ? 48 : 32;
      
      let t = `\x1B\x40` // Reset
      t += `\x1B\x61\x01` // Center
      t += `\x1B\x21\x30${sanitize(companyName).toUpperCase()}\n`
      t += `\x1B\x21\x08BOLETA INTERNA: ${sale.id}\n\n`
      
      t += `\x1B\x61\x00` // Left
      t += padLine("CLIENTE:", "FECHA:", charLimit) + "\n"
      const dateStr = sale.createdAt?.toDate ? sale.createdAt.toDate().toLocaleDateString() : "";
      t += padLine(sanitize(sale.customerName).substring(0, charLimit/2), dateStr, charLimit) + "\n"
      t += "-".repeat(charLimit) + "\n"
      
      sale.items.forEach((i: any, idx: number) => {
        const subtotal = `S/ ${(Number(i.quantity) * Number(i.price) - Number(i.discount)).toFixed(2)}`;
        t += padLine(`${idx + 1}- ${sanitize(i.name)}`, subtotal, charLimit) + "\n"
        t += `   ${i.quantity} x S/ ${Number(i.price).toFixed(2)}${Number(i.discount) > 0 ? ` (-S/ ${Number(i.discount).toFixed(2)})` : ''}\n`
        if (i.description) {
          t += `   ${sanitize(i.description).substring(0, charLimit - 3)}\n`
        }
      })
      
      t += "-".repeat(charLimit) + "\n"
      
      const totalQty = sale.items.reduce((acc: number, item: any) => acc + (Number(item.quantity) || 0), 0);
      t += padLine(`CANT. TOTAL: ${totalQty}`, `TOTAL: S/ ${Number(sale.total).toFixed(2)}`, charLimit) + "\n"
      
      t += "\n\x1B\x61\x01" // Center
      t += "Gracias por su Compra\n"
      t += "\n\n\n\n\x1D\x56\x42\x00" // Cut

      const encoder = new TextEncoder()
      const data = encoder.encode(t)
      const chunkSize = 20
      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize)
        await bleCharacteristic.writeValue(chunk)
      }
      
      toast({ title: "TICKET ENVIADO" })
    } catch (err) {
      toast({ variant: "destructive", title: "ERROR DE HARDWARE" })
      setBleDevice(null)
      setBleCharacteristic(null)
    }
  }

  const handleSendImage = async (sale: any) => {
    setActiveReceipt(sale)
    setTimeout(async () => {
      if (receiptRef.current) {
        try {
          const dataUrl = await toJpeg(receiptRef.current, { quality: 0.95, backgroundColor: '#ffffff' })
          const blob = await (await fetch(dataUrl)).blob()
          const file = new File([blob], `Boleta_${sale.id}.jpg`, { type: 'image/jpeg' })
          if (navigator.share && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
            await navigator.share({ files: [file], title: `Boleta ${sale.id}` })
          } else {
            const link = document.createElement('a')
            link.download = `Boleta_${sale.id}.jpg`
            link.href = dataUrl
            link.click()
            toast({ title: "IMAGEN DESCARGADA", description: "LISTO PARA COMPARTIR." })
          }
        } catch (err) {
          toast({ variant: "destructive", title: "ERROR AL GENERAR IMAGEN" })
        }
      }
    }, 400)
  }

  const brandColor = companySettings?.brandColor || "#FF3399";
  const companyName = companySettings?.companyName || "Diva Industrial";

  return (
    <div className="space-y-6 pt-2 pb-20 max-w-4xl mx-auto px-2 md:px-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b-4 border-black pb-6">
        <div>
          <h1 className="text-sm font-black text-black uppercase tracking-[0.3em]">Total Ventas del Mes</h1>
          <div className="font-headline font-black text-5xl md:text-6xl text-black tracking-tighter mt-1">
            S/ {currentMonthTotal.toFixed(2)}
          </div>
        </div>
        <div className="flex w-full md:w-auto gap-2">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-black/40" />
            <Input 
              placeholder="BUSCAR..." 
              className="pl-10 h-11 rounded-xl border-black/10 font-black text-xs uppercase bg-white shadow-sm"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px] h-11 rounded-xl border-black/10 font-black text-[10px] uppercase bg-white">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all" className="text-[10px] font-black uppercase">Todos</SelectItem>
              <SelectItem value="active" className="text-[10px] font-black uppercase">Activos</SelectItem>
              <SelectItem value="shipped" className="text-[10px] font-black uppercase">Enviados</SelectItem>
              <SelectItem value="annulled" className="text-[10px] font-black uppercase">Anulados</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-8">
        {groupedSales.map(group => (
          <div key={group.dateLabel} className="space-y-4">
            <div className="flex justify-between items-center px-6 py-3 bg-black text-white rounded-2xl shadow-lg">
              <span className="text-[10px] font-black uppercase tracking-widest">{group.dateLabel}</span>
              <span className="font-headline font-black text-lg">S/ {group.dayTotal.toFixed(2)}</span>
            </div>
            
            <div className="space-y-3">
              {group.sales.map(s => (
                <Card key={s.id} className={cn(
                  "rounded-2xl border border-black/5 overflow-hidden transition-all",
                  s.status === 'annulled' ? "opacity-40 bg-black/[0.02]" : "bg-white shadow-sm"
                )}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex justify-between items-center pr-8 md:pr-16">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-base text-black">{s.id}</span>
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-[7px] font-black h-4 px-2 uppercase border-none", 
                              s.status === 'active' && "bg-green-100 text-green-700",
                              s.status === 'shipped' && "bg-blue-100 text-blue-700",
                              s.status === 'annulled' && "bg-red-100 text-red-700"
                            )}
                          >
                            {s.status === 'active' ? 'ACTIVO' : s.status === 'shipped' ? 'ENVIADO' : 'ANULADO'}
                          </Badge>
                        </div>
                        <span className="font-headline font-black text-xl text-black">S/ {Number(s.total).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center pr-8 md:pr-16">
                        <span className="text-[10px] font-black text-black/60 uppercase truncate max-w-[150px] md:max-w-none">
                          {s.customerName}
                        </span>
                        <span className="text-[10px] font-black text-black/40 uppercase">
                          {s.items?.reduce((acc: number, item: any) => acc + (Number(item.quantity) || 0), 0)} UNID
                        </span>
                      </div>
                    </div>

                    <div className="relative">
                      {confirmAnnulId === s.id ? (
                        <div className="flex gap-1">
                          <Button size="icon" className="h-10 w-10 bg-destructive text-white rounded-xl" onClick={() => annulQuote(s)}><Check className="w-5 h-5" /></Button>
                          <Button size="icon" className="h-10 w-10 bg-black/5 text-black rounded-xl" onClick={() => setConfirmAnnulId(null)}><X className="w-5 h-5" /></Button>
                        </div>
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-12 w-10 rounded-xl hover:bg-black/5">
                              <MoreVertical className="w-6 h-6 text-black" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-2xl border-black/10 shadow-2xl p-2 w-56">
                            <DropdownMenuItem className="text-[11px] font-black uppercase gap-3 p-4 rounded-xl cursor-pointer" onClick={() => router.push(`/quotes?edit=${s.id}`)}>
                              <Edit2 className="w-4 h-4" /> Editar Venta
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-[11px] font-black uppercase gap-3 p-4 rounded-xl cursor-pointer" onClick={() => handlePrintBLE(s)}>
                              {bleDevice ? <Printer className="w-4 h-4" /> : <Bluetooth className="w-4 h-4" />} {bleDevice ? 'Imprimir Ticket' : 'Conectar Impresora'}
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-[11px] font-black uppercase gap-3 p-4 rounded-xl cursor-pointer" onClick={() => handleSendImage(s)}>
                              <ImageIcon className="w-4 h-4" /> Enviar Imagen
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-[11px] font-black uppercase gap-3 p-4 rounded-xl cursor-pointer" onClick={() => {
                              const summary = `Venta ${s.id}\nCliente: ${s.customerName}\nTotal: S/ ${Number(s.total).toFixed(2)}\n\nItems:\n${s.items.map((i: any) => `- ${i.name} (${i.quantity})`).join('\n')}`;
                              navigator.clipboard.writeText(summary);
                              toast({ title: "RESUMEN COPIADO", description: "Listo para enviar." });
                            }}>
                              <FileText className="w-4 h-4" /> Enviar Texto
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-[11px] font-black uppercase gap-3 p-4 rounded-xl text-destructive cursor-pointer" onClick={() => setConfirmAnnulId(s.id)}>
                              <Ban className="w-4 h-4" /> Anular Boleta
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

      {/* Hidden Receipt for Image Generation - High Quality Industrial Design */}
      <div className="fixed -left-[3000px] top-0">
        {activeReceipt && (
          <div ref={receiptRef} className="w-[1000px] p-16 bg-white flex flex-col gap-10" style={{ borderTop: `30px solid ${brandColor}` }}>
            <div className="flex justify-between items-start">
              <div className="space-y-4">
                <h2 className="text-7xl font-headline font-black uppercase tracking-tighter leading-none">{companyName}</h2>
                <div className="inline-block bg-black text-white px-6 py-2 rounded-xl text-xl font-black tracking-[0.4em]">BOLETA INTERNA</div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-black uppercase opacity-30 tracking-widest">Serie B</div>
                <div className="text-7xl font-headline font-black" style={{ color: brandColor }}>{activeReceipt.id}</div>
              </div>
            </div>
            
            <div className="h-1 bg-black/5 w-full" />
            
            <div className="grid grid-cols-2 gap-16">
              <div className="space-y-2">
                <div className="text-sm font-black uppercase opacity-40">Cliente Diva:</div>
                <div className="text-4xl font-black uppercase leading-tight">{activeReceipt.customerName}</div>
              </div>
              <div className="text-right space-y-2">
                <div className="text-sm font-black uppercase opacity-40">Fecha de Emisión:</div>
                <div className="text-4xl font-black uppercase">
                  {activeReceipt.createdAt?.toDate 
                    ? activeReceipt.createdAt.toDate().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase() 
                    : "---"}
                </div>
              </div>
            </div>

            <table className="w-full mt-6">
              <thead>
                <tr className="border-b-8 border-black text-left">
                  <th className="py-8 text-2xl font-black uppercase">Detalle de Prenda</th>
                  <th className="py-8 text-2xl font-black uppercase text-center">Cant</th>
                  <th className="py-8 text-2xl font-black uppercase text-right">Unitario</th>
                  <th className="py-8 text-2xl font-black uppercase text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {activeReceipt.items.map((item: any, idx: number) => (
                  <tr key={idx} className="align-top">
                    <td className="py-10">
                      <div className="text-3xl font-black uppercase">{idx + 1}- {item.name}</div>
                      <div className="text-sm font-black uppercase opacity-40 mt-1">{item.productId} | {item.description || "SIN NOTAS"}</div>
                      {Number(item.discount) > 0 && (
                        <div className="text-sm font-black uppercase text-primary mt-2 flex items-center gap-2">
                          <span className="bg-primary/10 px-2 py-0.5 rounded">Dscto: S/ {Number(item.discount).toFixed(2)}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-10 text-3xl font-black text-center">{item.quantity}</td>
                    <td className="py-10 text-3xl font-black text-right">S/ {Number(item.price).toFixed(2)}</td>
                    <td className="py-10 text-3xl font-black text-right">
                      S/ {(Number(item.quantity) * Number(item.price) - Number(item.discount)).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-12 pt-12 border-t-8 border-black flex justify-between items-end">
              <div className="space-y-2">
                <div className="text-2xl font-black uppercase opacity-40">Unidades Totales:</div>
                <div className="text-6xl font-black">
                  {activeReceipt.items.reduce((acc: number, item: any) => acc + (Number(item.quantity) || 0), 0)} UND
                </div>
              </div>
              <div className="text-right space-y-4">
                <div className="text-3xl font-black uppercase opacity-40">Monto Total Neto</div>
                <div className="text-9xl font-headline font-black tracking-tighter leading-none" style={{ color: brandColor }}>
                  S/ {Number(activeReceipt.total).toFixed(2)}
                </div>
              </div>
            </div>
            
            <div className="text-center mt-20">
              <div className="h-px bg-black/10 w-48 mx-auto mb-6" />
              <div className="text-3xl font-black uppercase opacity-40 tracking-[0.5em]">Gracias por su Compra</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
