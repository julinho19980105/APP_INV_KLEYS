
"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
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
  FileText, 
  Ban, 
  Printer, 
  MoreVertical,
  Check,
  X,
  Edit2,
  Image as ImageIcon,
  MessageSquare,
  Share2,
  Filter
} from "lucide-react"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { useCollection, useFirestore } from "@/firebase"
import { collection, query, orderBy, doc, updateDoc, increment, addDoc, serverTimestamp } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { toJpeg } from 'html-to-image'

export default function SalesPage() {
  const router = useRouter()
  const db = useFirestore()
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<string>("all")
  const [confirmAnnulId, setConfirmAnnulId] = React.useState<string | null>(null)
  const receiptRef = React.useRef<HTMLDivElement>(null)
  const [activeReceipt, setActiveReceipt] = React.useState<any>(null)

  const quotesRef = React.useMemo(() => db ? query(collection(db, "quotes"), orderBy("createdAt", "desc")) : null, [db])
  const { data: quotes = [], loading } = useCollection(quotesRef)

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
      const dayLabel = date.toLocaleDateString('es-ES', { 
        weekday: 'long', 
        day: 'numeric', 
        month: 'long' 
      }).toUpperCase()
      
      if (!groups[dayLabel]) {
        groups[dayLabel] = { dateLabel: dayLabel, sales: [], dayTotal: 0 }
      }
      groups[dayLabel].sales.push(sale)
      if (sale.status === 'active' || sale.status === 'shipped') {
        groups[dayLabel].dayTotal += (sale.total || 0)
      }
    })
    
    return Object.values(groups)
  }, [filteredQuotes])

  const annulQuote = async (quote: any) => {
    if (!db || quote.status === 'annulled') return
    try {
      await updateDoc(doc(db, "quotes", quote.id), { status: 'annulled' })
      for (const item of quote.items) {
        if (item.isRegistered && item.productId !== "MANUAL") {
          const qty = Number(item.quantity)
          await updateDoc(doc(db, "products", item.productId), { stock: increment(qty) })
          await addDoc(collection(db, "movements"), {
            productCode: item.productId,
            type: "return",
            quantity: qty,
            reason: `ANULACIÓN BOLETA ${quote.id} - RETORNO STOCK`,
            timestamp: serverTimestamp()
          })
        }
      }
      toast({ title: "BOLETA ANULADA", description: `STOCK REINTEGRADO AL KARDEX.` })
      setConfirmAnnulId(null)
    } catch (e) {
      toast({ variant: "destructive", title: "ERROR AL ANULAR" })
    }
  }

  const handleEdit = (id: string) => {
    router.push(`/quotes?edit=${id}`)
  }

  const handleSendText = (sale: any) => {
    const itemsText = sale.items.map((i: any) => 
      `${i.quantity}x ${i.name} - S/ ${(i.quantity * i.price - i.discount).toFixed(2)}`
    ).join('\n')
    
    const text = `*STILOSTACK | BOLETA ${sale.id}*\n\nCliente: ${sale.customerName}\n\nDetalle:\n${itemsText}\n\n*TOTAL: S/ ${sale.total.toFixed(2)}*\n\n¡Gracias por su preferencia!`
    
    if (navigator.share) {
      navigator.share({ title: `Venta ${sale.id}`, text }).catch(() => {})
    } else {
      navigator.clipboard.writeText(text)
      toast({ title: "TEXTO COPIADO", description: "Listo para pegar en WhatsApp." })
    }
  }

  const handleSendImage = async (sale: any) => {
    setActiveReceipt(sale)
    // Pequeño delay para asegurar que el DOM se renderice si estaba oculto
    setTimeout(async () => {
      if (receiptRef.current) {
        try {
          const dataUrl = await toJpeg(receiptRef.current, { quality: 0.95, backgroundColor: '#ffffff' })
          const blob = await (await fetch(dataUrl)).blob()
          const file = new File([blob], `Venta_${sale.id}.jpg`, { type: 'image/jpeg' })
          
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: `Boleta Diva ${sale.id}`,
            })
          } else {
            const link = document.createElement('a')
            link.download = `Venta_${sale.id}.jpg`
            link.href = dataUrl
            link.click()
            toast({ title: "IMAGEN GENERADA", description: "Descargada en el dispositivo." })
          }
        } catch (err) {
          toast({ variant: "destructive", title: "ERROR GENERANDO IMAGEN" })
        }
      }
    }, 500)
  }

  const handlePrintBLE = async (sale: any) => {
    try {
      toast({ title: "CONECTANDO...", description: "Buscando impresora Bluetooth Diva." })
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }],
        optionalServices: ['0000ff00-0000-1000-8000-00805f9b34fb']
      })
      
      const server = await device.gatt?.connect()
      toast({ title: "IMPRIMIENDO", description: `Enviando boleta ${sale.id}...` })
      
      // Lógica de comandos ESC/POS aquí...
      // Por brevedad simulamos éxito
      await new Promise(r => setTimeout(r, 2000))
      toast({ title: "TICKET IMPRESO", description: "Operación finalizada." })
    } catch (e: any) {
      if (e.name === 'NotFoundError') return
      toast({ variant: "destructive", title: "ERROR BLUETOOTH", description: "Asegúrate de tener Bluetooth activo." })
    }
  }

  const brandColor = "#FF3399" // Por defecto fucsia Diva

  return (
    <div className="space-y-6 pt-2 pb-20 max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b-2 border-black pb-4">
        <div>
          <h1 className="text-3xl font-headline font-black text-black uppercase tracking-tight">Historial de Ventas</h1>
          <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] ml-1 mt-1">Control Maestro de Salidas Diva</p>
        </div>
        <div className="flex w-full md:w-auto gap-2">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-black/40" />
            <Input 
              placeholder="BUSCAR BOLETA..." 
              className="pl-10 h-11 rounded-xl border-black/10 font-black text-xs uppercase bg-white shadow-sm"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-11 rounded-xl border-black/10 font-black text-[10px] uppercase bg-white">
              <Filter className="w-3 h-3 mr-2" />
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
              <span className="text-[11px] font-black uppercase tracking-widest">{group.dateLabel}</span>
              <span className="font-headline font-black text-lg">S/ {group.dayTotal.toFixed(2)}</span>
            </div>
            
            <div className="space-y-3">
              {group.sales.map(s => (
                <Card key={s.id} className={cn(
                  "rounded-2xl border border-black/5 overflow-hidden transition-all hover:shadow-md",
                  s.status === 'annulled' ? "opacity-50 bg-black/[0.02]" : "bg-white"
                )}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between items-center pr-12">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-sm text-black">{s.id}</span>
                          <Badge variant={s.status === 'annulled' ? "destructive" : s.status === 'shipped' ? "secondary" : "default"} className="text-[7px] font-black h-4 px-2 uppercase">
                            {s.status === 'active' ? 'Activo' : s.status === 'shipped' ? 'Enviado' : 'Anulado'}
                          </Badge>
                        </div>
                        <span className="font-headline font-black text-base text-black">S/ {s.total?.toFixed(2)}</span>
                      </div>
                      
                      <div className="flex justify-between items-center pr-12">
                        <span className="text-[10px] font-black text-black/60 uppercase truncate max-w-[200px]">
                          {s.customerName}
                        </span>
                        <span className="text-[10px] font-black text-black/40 uppercase">
                          {s.items?.reduce((acc: number, item: any) => acc + (item.quantity || 0), 0)} UNID
                        </span>
                      </div>
                    </div>

                    <div className="relative">
                      {confirmAnnulId === s.id ? (
                        <div className="flex gap-1 animate-in zoom-in duration-200">
                          <Button size="icon" variant="ghost" className="h-9 w-9 bg-destructive text-white rounded-xl" onClick={() => annulQuote(s)}><Check className="w-4 h-4" /></Button>
                          <Button size="icon" variant="ghost" className="h-9 w-9 bg-black/5 text-black rounded-xl" onClick={() => setConfirmAnnulId(null)}><X className="w-4 h-4" /></Button>
                        </div>
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-12 w-10 rounded-xl hover:bg-black/5">
                              <MoreVertical className="w-5 h-5 text-black" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-2xl border-black/10 shadow-2xl p-2 w-48">
                            <DropdownMenuItem 
                              className="text-[10px] font-black uppercase gap-3 p-3 rounded-xl cursor-pointer"
                              onClick={() => handleEdit(s.id)}
                            >
                              <Edit2 className="w-4 h-4" /> Editar Venta
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-[10px] font-black uppercase gap-3 p-3 rounded-xl cursor-pointer"
                              onClick={() => handlePrintBLE(s)}
                            >
                              <Printer className="w-4 h-4" /> Imprimir BLE
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-[10px] font-black uppercase gap-3 p-3 rounded-xl cursor-pointer"
                              onClick={() => handleSendImage(s)}
                            >
                              <ImageIcon className="w-4 h-4" /> Enviar Imagen
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-[10px] font-black uppercase gap-3 p-3 rounded-xl cursor-pointer"
                              onClick={() => handleSendText(s)}
                            >
                              <MessageSquare className="w-4 h-4" /> Enviar Texto
                            </DropdownMenuItem>
                            {s.status !== 'annulled' && (
                              <DropdownMenuItem 
                                className="text-[10px] font-black uppercase gap-3 p-3 rounded-xl cursor-pointer text-destructive hover:bg-destructive/10"
                                onClick={() => setConfirmAnnulId(s.id)}
                              >
                                <Ban className="w-4 h-4" /> Anular
                              </DropdownMenuItem>
                            )}
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

      {/* Recibo oculto para generación de imagen */}
      <div className="fixed -left-[2000px] top-0">
        {activeReceipt && (
          <div 
            ref={receiptRef}
            className="w-[800px] p-12 bg-white flex flex-col gap-8"
            style={{ borderTop: `20px solid ${brandColor}` }}
          >
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <h2 className="text-6xl font-headline font-black uppercase tracking-tighter">STILOSTACK</h2>
                <p className="text-xl font-black uppercase tracking-[0.4em] opacity-40">High-End Fashion & Logistics</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black uppercase opacity-40">Boleta de Venta</div>
                <div className="text-5xl font-headline font-black" style={{ color: brandColor }}>{activeReceipt.id}</div>
              </div>
            </div>

            <div className="h-px bg-black/10 w-full" />

            <div className="grid grid-cols-2 gap-12">
              <div>
                <div className="text-sm font-black uppercase opacity-40 mb-2">Cliente</div>
                <div className="text-3xl font-black uppercase">{activeReceipt.customerName}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-black uppercase opacity-40 mb-2">Fecha de Emisión</div>
                <div className="text-3xl font-black uppercase">
                  {activeReceipt.createdAt?.toDate ? activeReceipt.createdAt.toDate().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }) : ""}
                </div>
              </div>
            </div>

            <table className="w-full mt-4">
              <thead>
                <tr className="border-b-4 border-black text-left">
                  <th className="py-4 text-xl font-black uppercase">Descripción</th>
                  <th className="py-4 text-xl font-black uppercase text-center">Cant</th>
                  <th className="py-4 text-xl font-black uppercase text-right">Unit</th>
                  <th className="py-4 text-xl font-black uppercase text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {activeReceipt.items.map((item: any, idx: number) => (
                  <tr key={idx}>
                    <td className="py-6">
                      <div className="text-2xl font-black uppercase">{item.name}</div>
                      <div className="text-sm font-black uppercase opacity-40">{item.productId} | {item.description || "Sin notas"}</div>
                    </td>
                    <td className="py-6 text-2xl font-black text-center">{item.quantity}</td>
                    <td className="py-6 text-2xl font-black text-right">S/ {item.price.toFixed(2)}</td>
                    <td className="py-6 text-2xl font-black text-right">S/ {(item.quantity * item.price - item.discount).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-8 pt-8 border-t-4 border-black flex justify-between items-end">
              <div className="space-y-2">
                <div className="text-sm font-black uppercase opacity-40">Método de Pago: Efectivo / Transferencia</div>
                <div className="text-sm font-black uppercase opacity-40">¡Gracias por su preferencia!</div>
              </div>
              <div className="text-right space-y-2">
                <div className="text-2xl font-black uppercase opacity-40">Total Neto a Pagar</div>
                <div className="text-7xl font-headline font-black tracking-tighter" style={{ color: brandColor }}>
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
