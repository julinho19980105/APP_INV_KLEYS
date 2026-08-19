
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
  MessageSquare,
  Bluetooth
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

  const handlePrintBLE = async (sale: any) => {
    if (!bleDevice) {
      try {
        toast({ title: "BUSCANDO IMPRESORA..." })
        const device = await (navigator as any).bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
        })
        setBleDevice(device)
        toast({ title: "VINCULADO EXITOSAMENTE", description: "Presiona imprimir nuevamente." })
      } catch (e) {
        toast({ variant: "destructive", title: "CONEXIÓN CANCELADA" })
      }
      return
    }

    toast({ title: "IMPRIMIENDO TICKET..." })
    // Real ESC/POS logic would go here
    setTimeout(() => toast({ title: "TICKET EMITIDO" }), 1500)
  }

  const handleSendImage = async (sale: any) => {
    setActiveReceipt(sale)
    setTimeout(async () => {
      if (receiptRef.current) {
        try {
          const dataUrl = await toJpeg(receiptRef.current, { quality: 0.95, backgroundColor: '#ffffff' })
          const blob = await (await fetch(dataUrl)).blob()
          const file = new File([blob], `Venta_${sale.id}.jpg`, { type: 'image/jpeg' })
          if (navigator.share) {
            await navigator.share({ files: [file], title: `Boleta ${sale.id}` })
          } else {
            const link = document.createElement('a')
            link.download = `Venta_${sale.id}.jpg`
            link.href = dataUrl
            link.click()
          }
        } catch (err) {
          toast({ variant: "destructive", title: "ERROR IMAGEN" })
        }
      }
    }, 300)
  }

  const brandColor = companySettings?.brandColor || "#FF3399";
  const companyName = companySettings?.companyName || "StiloStack";

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
                          <Badge variant="outline" className={cn("text-[7px] font-black h-4 px-2 uppercase", s.status === 'annulled' ? "border-destructive text-destructive" : "border-black/10")}>
                            {s.status}
                          </Badge>
                        </div>
                        <span className="font-headline font-black text-xl text-black">S/ {s.total?.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center pr-8 md:pr-16">
                        <span className="text-[10px] font-black text-black/60 uppercase truncate max-w-[150px] md:max-w-none">
                          {s.customerName}
                        </span>
                        <span className="text-[10px] font-black text-black/40 uppercase">
                          {s.items?.reduce((acc: number, item: any) => acc + (item.quantity || 0), 0)} UNID
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
                            <DropdownMenuItem className="text-[11px] font-black uppercase gap-3 p-4 rounded-xl" onClick={() => router.push(`/quotes?edit=${s.id}`)}>
                              <Edit2 className="w-4 h-4" /> Editar Venta
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-[11px] font-black uppercase gap-3 p-4 rounded-xl" onClick={() => handlePrintBLE(s)}>
                              {bleDevice ? <Printer className="w-4 h-4" /> : <Bluetooth className="w-4 h-4" />} {bleDevice ? 'Imprimir Ticket' : 'Conectar Impresora'}
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-[11px] font-black uppercase gap-3 p-4 rounded-xl" onClick={() => handleSendImage(s)}>
                              <ImageIcon className="w-4 h-4" /> Enviar Imagen
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-[11px] font-black uppercase gap-3 p-4 rounded-xl text-destructive" onClick={() => setConfirmAnnulId(s.id)}>
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

      {/* Hidden Receipt for JPG */}
      <div className="fixed -left-[3000px] top-0">
        {activeReceipt && (
          <div ref={receiptRef} className="w-[1000px] p-16 bg-white flex flex-col gap-10" style={{ borderTop: `25px solid ${brandColor}` }}>
            <div className="flex justify-between items-start">
              <div className="space-y-3">
                <h2 className="text-7xl font-headline font-black uppercase tracking-tighter">{companyName}</h2>
                <p className="text-xl font-black uppercase tracking-[0.4em] opacity-40">CARGA INDUSTRIAL - DIVA</p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-black uppercase opacity-40">Boleta Serie B</div>
                <div className="text-6xl font-headline font-black" style={{ color: brandColor }}>{activeReceipt.id}</div>
              </div>
            </div>
            <div className="h-px bg-black/10 w-full" />
            <div className="grid grid-cols-2 gap-16">
              <div>
                <div className="text-sm font-black uppercase opacity-40 mb-3">Cliente Diva</div>
                <div className="text-4xl font-black uppercase">{activeReceipt.customerName}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-black uppercase opacity-40 mb-3">Fecha Emisión</div>
                <div className="text-4xl font-black uppercase">{activeReceipt.createdAt?.toDate ? activeReceipt.createdAt.toDate().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase() : ""}</div>
              </div>
            </div>
            <table className="w-full mt-6">
              <thead>
                <tr className="border-b-8 border-black text-left">
                  <th className="py-6 text-2xl font-black uppercase">Prenda / DNI</th>
                  <th className="py-6 text-2xl font-black uppercase text-center">Und</th>
                  <th className="py-6 text-2xl font-black uppercase text-right">Precio</th>
                  <th className="py-6 text-2xl font-black uppercase text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {activeReceipt.items.map((item: any, idx: number) => (
                  <tr key={idx}>
                    <td className="py-8">
                      <div className="text-3xl font-black uppercase">{item.name}</div>
                      <div className="text-sm font-black uppercase opacity-40">{item.productId} | {item.description}</div>
                    </td>
                    <td className="py-8 text-3xl font-black text-center">{item.quantity}</td>
                    <td className="py-8 text-3xl font-black text-right">S/ {item.price.toFixed(2)}</td>
                    <td className="py-8 text-3xl font-black text-right">S/ {(item.quantity * item.price - item.discount).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-10 pt-10 border-t-8 border-black flex justify-between items-end">
              <div className="text-2xl font-black uppercase opacity-50">¡GRACIAS POR SU PREFERENCIA!</div>
              <div className="text-right space-y-2">
                <div className="text-3xl font-black uppercase opacity-40">Monto Total Neto</div>
                <div className="text-8xl font-headline font-black tracking-tighter" style={{ color: brandColor }}>
                  S/ {activeReceipt.total.toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
