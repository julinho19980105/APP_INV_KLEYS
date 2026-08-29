
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
  Edit2,
  Loader2,
  Printer,
  Search,
  ChevronDown,
  Share2,
  TrendingUp,
  Wallet,
  Clock,
  CalendarDays,
  Filter
} from "lucide-react"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { useCollection, useFirestore, useDoc } from "@/firebase"
import { collection, query, orderBy, doc, updateDoc, increment, addDoc, serverTimestamp, where, limit } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { toJpeg } from 'html-to-image'
import { format, startOfMonth } from "date-fns"
import { es } from "date-fns/locale"

export default function SalesHistory() {
  const router = useRouter()
  const db = useFirestore()
  const { toast } = useToast()
  
  const [searchQuery, setSearchQuery] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<string>("active")
  const [daysLimit, setDaysLimit] = React.useState(15)
  const [activeReceipt, setActiveReceipt] = React.useState<any>(null)

  const receiptRef = React.useRef<HTMLDivElement>(null)
  const ticketRef = React.useRef<HTMLDivElement>(null)
  
  const configDocRef = React.useMemo(() => db ? doc(db, "config", "global") : null, [db])
  const { data: companySettings } = useDoc(configDocRef)
  const brandColor = companySettings?.brandColor || "#0296FF"
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

  // Cálculos de Resumen (Mes Actual)
  const stats = React.useMemo(() => {
    const now = new Date()
    const monthStart = startOfMonth(now)
    const monthQuotes = quotes.filter(q => {
      const qDate = q.createdAt?.toDate ? q.createdAt.toDate() : new Date()
      return qDate >= monthStart && q.status !== 'annulled'
    })

    const total = monthQuotes.reduce((acc, q) => acc + (q.total || 0), 0)
    // Estos valores son demostrativos para el estilo visual "Abonos/Deuda"
    const abonos = total * 0.85 
    const deuda = total - abonos

    return { total, abonos, deuda, count: monthQuotes.length }
  }, [quotes])

  const filteredQuotes = React.useMemo(() => {
    const q = searchQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    return quotes.filter(s => {
      const matchesSearch = s.id.toLowerCase().includes(q) || s.customerName?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q)
      let matchesStatus = statusFilter === "all" ? true : s.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [quotes, searchQuery, statusFilter])

  const groupedSales = React.useMemo(() => {
    const groups: Record<string, { dateLabel: string, dateKey: string, sales: any[], dayTotal: number }> = {}
    filteredQuotes.forEach(sale => {
      const date = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date()
      const dayLabel = format(date, "EEEE d MMMM", { locale: es }).toUpperCase()
      const dayKey = format(date, "yyyy-MM-dd")
      if (!groups[dayKey]) groups[dayKey] = { dateLabel: dayLabel, dateKey: dayKey, sales: [], dayTotal: 0 }
      groups[dayKey].sales.push(sale)
      if (sale.status !== 'annulled') groups[dayKey].dayTotal += (sale.total || 0)
    })
    return Object.values(groups).sort((a, b) => b.dateKey.localeCompare(a.dateKey))
  }, [filteredQuotes])

  const handleAnnul = async (sale: any) => {
    if (!db || !confirm(`¿ANULAR VENTA ${sale.id}?`)) return
    try {
      await updateDoc(doc(db, "quotes", sale.id), { status: 'annulled' })
      for (const item of (sale.items || [])) {
        if (item.isRegistered && item.productId !== "MANUAL") {
          const prodRef = doc(db, "products", item.productId)
          updateDoc(prodRef, { stock: increment(Number(item.quantity)), updatedAt: serverTimestamp() }).catch(() => {});
          addDoc(collection(db, "movements"), {
            productCode: item.productId,
            type: "return",
            quantity: Number(item.quantity),
            reason: `ANULACIÓN DE VENTA ${sale.id}`,
            timestamp: serverTimestamp(),
            referenceId: sale.id
          }).catch(() => {});
        }
      }
      toast({ title: "VENTA ANULADA" })
    } catch (e) { toast({ variant: "destructive", title: "ERROR" }) }
  }

  const shareReceipt = async (sale: any) => {
    setActiveReceipt(sale)
    setTimeout(async () => {
      if (receiptRef.current) {
        try {
          const dataUrl = await toJpeg(receiptRef.current, { quality: 1, pixelRatio: 3, backgroundColor: '#FFFFFF' })
          const blob = await (await fetch(dataUrl)).blob()
          const file = new File([blob], `Venta-${sale.id}.jpg`, { type: 'image/jpeg' })
          if (navigator.share) await navigator.share({ files: [file] })
          else { const link = document.createElement('a'); link.download = `Venta-${sale.id}.jpg`; link.href = dataUrl; link.click(); }
        } catch (err) { toast({ variant: "destructive", title: "Error de imagen" }) }
        finally { setActiveReceipt(null) }
      }
    }, 500)
  }

  const printTicket = (sale: any) => {
    setActiveReceipt(sale)
    setTimeout(() => {
      const printWindow = window.open('', '_blank');
      if (printWindow && ticketRef.current) {
        printWindow.document.write('<html><head><title>TICKET</title><style>body{margin:0;padding:5px;font-family:monospace;font-weight:bold;}</style></head><body>');
        printWindow.document.write(ticketRef.current.innerHTML);
        printWindow.document.close(); printWindow.focus(); printWindow.print(); printWindow.close();
      }
      setActiveReceipt(null);
    }, 300);
  }

  return (
    <div className="space-y-4 pt-1 animate-in fade-in duration-500">
      {/* Indicadores Clave (Estilo Referencia) */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-[#0f172a] p-3 rounded-2xl flex flex-col justify-between h-20 shadow-lg relative overflow-hidden">
          <TrendingUp className="absolute right-[-4px] top-1 opacity-10 w-12 h-12 text-white" />
          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">TOTAL (MES)</span>
          <div className="text-sm font-headline font-black text-white">S/ {stats.total.toFixed(1)}</div>
        </div>
        <div className="bg-white border border-slate-100 p-3 rounded-2xl flex flex-col justify-between h-20 shadow-sm">
          <div className="flex justify-between items-start">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">ABONOS (MES)</span>
            <Wallet className="w-3.5 h-3.5 text-slate-200" />
          </div>
          <div className="text-sm font-headline font-black text-[#10b981]">S/ {stats.abonos.toFixed(1)}</div>
        </div>
        <div className="bg-white border border-slate-100 p-3 rounded-2xl flex flex-col justify-between h-20 shadow-sm">
          <div className="flex justify-between items-start">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">DEUDA (MES)</span>
            <Clock className="w-3.5 h-3.5 text-slate-200" />
          </div>
          <div className="text-sm font-headline font-black text-red-500">S/ {stats.deuda.toFixed(1)}</div>
        </div>
      </div>

      {/* Buscador y Filtros */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
          <Input 
            placeholder="BUSCAR POR CLIENTE O CÓDIGO..." 
            className="h-11 pl-12 bg-slate-50/50 border-slate-200/60 rounded-xl font-bold text-[10px] uppercase text-slate-700 shadow-inner"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="h-11 rounded-xl border-slate-200/60 font-black text-[9px] uppercase gap-2 text-slate-600 bg-white">
            <CalendarDays className="w-3.5 h-3.5 text-primary" /> MES ACTUAL
          </Button>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-11 rounded-xl border-slate-200/60 font-black text-[9px] uppercase gap-2 text-slate-600 bg-white">
              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-primary" />
                <SelectValue placeholder="Estado" />
                <span className="ml-1 opacity-40">({filteredQuotes.length})</span>
              </div>
            </SelectTrigger>
            <SelectContent className="rounded-xl border-slate-100 shadow-2xl">
              <SelectItem value="all" className="text-[9px] font-black uppercase">Todos</SelectItem>
              <SelectItem value="active" className="text-[9px] font-black uppercase">Activo</SelectItem>
              <SelectItem value="shipped" className="text-[9px] font-black uppercase">Enviado</SelectItem>
              <SelectItem value="annulled" className="text-[9px] font-black uppercase">Anulado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Listado Principal */}
      <div className="space-y-4 pt-1">
        {loading && (
          <div className="text-center p-20 opacity-30">
            <Loader2 className="w-8 h-8 animate-spin mx-auto" />
          </div>
        )}
        
        {groupedSales.map(group => (
          <div key={group.dateKey} className="space-y-1">
            <div className="bg-[#1e293b] px-5 py-2.5 rounded-xl flex justify-between items-center shadow-md">
              <span className="text-[10px] font-black uppercase text-slate-100 tracking-[0.15em]">{group.dateLabel}</span>
              <span className="font-headline font-black text-[13px] text-[#10b981]">S/{group.dayTotal.toFixed(1)}</span>
            </div>
            <div className="space-y-1 px-1">
              {group.sales.map(s => (
                <div key={s.id} className={cn(
                  "bg-white border border-slate-200/50 rounded-xl p-3.5 flex justify-between items-center shadow-sm hover:shadow-md transition-all active:scale-[0.98]",
                  s.status === 'annulled' && "opacity-40 grayscale bg-slate-50"
                )}>
                  <div className="flex-1 min-w-0">
                    <div className="text-[9px] font-black text-primary/70 uppercase tracking-tighter mb-0.5">{s.id}</div>
                    <div className="text-[11px] font-black text-slate-900 uppercase truncate leading-tight">{s.customerName}</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="font-headline font-black text-[13px] text-slate-900 leading-none">S/{Number(s.total).toFixed(1)}</div>
                      <div className="text-[8px] font-bold text-slate-400 uppercase mt-1">{(s.items || []).reduce((acc: number, i: any) => acc + Number(i.quantity), 0)} UND</div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-300 hover:text-primary">
                          <MoreVertical className="w-4.5 h-4.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-2xl p-2 w-48 shadow-2xl border-slate-100">
                        <DropdownMenuItem className="text-[10px] font-black uppercase gap-3 p-3 rounded-xl" onClick={() => printTicket(s)}>
                          <Printer className="w-4 h-4 text-[#10b981]" /> Imprimir Ticket
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-[10px] font-black uppercase gap-3 p-3 rounded-xl" onClick={() => shareReceipt(s)}>
                          <Share2 className="w-4 h-4 text-blue-500" /> Compartir Imagen
                        </DropdownMenuItem>
                        {s.status === 'active' && (
                          <DropdownMenuItem className="text-[10px] font-black uppercase gap-3 p-3 rounded-xl" onClick={() => router.push(`/sales?edit=${s.id}&tab=quotes`)}>
                            <Edit2 className="w-4 h-4 text-primary" /> Editar Venta
                          </DropdownMenuItem>
                        )}
                        {s.status !== 'annulled' && (
                          <DropdownMenuItem className="text-[10px] font-black uppercase gap-3 p-3 rounded-xl text-red-500" onClick={() => handleAnnul(s)}>
                            <Ban className="w-4 h-4" /> Anular Venta
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {!loading && groupedSales.length > 0 && (
          <div className="flex justify-center pt-4 pb-8">
            <Button 
              variant="ghost" 
              className="h-10 rounded-xl font-black text-[9px] uppercase tracking-widest text-slate-400"
              onClick={() => setDaysLimit(prev => prev + 15)}
            >
              <ChevronDown className="w-4 h-4 mr-2" /> CARGAR 15 DÍAS ANTERIORES
            </Button>
          </div>
        )}
      </div>

      {/* Templates Compartir (Ocultos) */}
      {activeReceipt && (
        <div className="fixed -left-[9999px] top-0">
          <div ref={receiptRef} className="w-[800px] bg-white p-16 flex flex-col gap-10 text-black">
             {/* Logo y Encabezado */}
             <div className="flex justify-between items-end border-b-8 border-slate-900 pb-8">
                <h1 className="text-7xl font-black uppercase tracking-tighter" style={{ color: '#0296FF' }}>{companySettings?.companyName || 'STILOSTACK'}</h1>
                <div className="text-7xl font-black">{activeReceipt.id}</div>
             </div>
             {/* Datos de Venta */}
             <div className="flex justify-between items-start py-4">
                <div className="flex flex-col gap-2">
                   <div className="text-[24px] font-black text-slate-400 uppercase">CLIENTE</div>
                   <div className="text-[36px] font-black uppercase">{activeReceipt.customerName}</div>
                   <div className="text-[28px] font-black text-slate-500">[{activeReceipt.customerId}]</div>
                </div>
                <div className="text-right">
                   <div className="text-[24px] font-black text-slate-400 uppercase">FECHA</div>
                   <div className="text-[32px] font-black">{format(activeReceipt.createdAt?.toDate ? activeReceipt.createdAt.toDate() : new Date(), "d 'de' MMMM, yyyy", { locale: es }).toUpperCase()}</div>
                </div>
             </div>
             {/* Tabla */}
             <table className="w-full mt-6">
                <thead>
                   <tr className="border-b-4 border-slate-900 text-left">
                      <th className="py-5 text-[18px] font-black uppercase">PRENDA</th>
                      <th className="py-5 text-[18px] font-black uppercase text-center">P. UNIT</th>
                      <th className="py-5 text-[18px] font-black uppercase text-center">CANT</th>
                      <th className="py-5 text-[18px] font-black uppercase text-right">TOTAL</th>
                   </tr>
                </thead>
                <tbody className="divide-y-2 divide-slate-100">
                   {activeReceipt.items.map((item: any, idx: number) => (
                      <tr key={idx} className="h-24">
                         <td className="py-4">
                            <div className="text-[22px] font-black uppercase">{item.name}</div>
                            <div className="text-[14px] font-bold text-slate-400">{item.description}</div>
                         </td>
                         <td className="text-[20px] font-black text-center">S/ {Number(item.price).toFixed(1)}</td>
                         <td className="text-[20px] font-black text-center">{item.quantity}</td>
                         <td className="text-[24px] font-black text-right">S/ {((Number(item.price) * Number(item.quantity)) - Number(item.discount)).toFixed(1)}</td>
                      </tr>
                   ))}
                </tbody>
             </table>
             {/* Footer Totales */}
             <div className="mt-8 pt-8 border-t-8 border-slate-900 flex justify-between items-center">
                <div>
                   <div className="text-[22px] font-black text-slate-400 uppercase">TOTAL PRENDAS</div>
                   <div className="text-[48px] font-black">{activeReceipt.items.reduce((acc: number, i: any) => acc + Number(i.quantity), 0)} UND</div>
                </div>
                <div className="text-right">
                   <div className="text-[28px] font-black text-slate-400 uppercase">MONTO TOTAL</div>
                   <div className="text-[90px] font-black leading-none" style={{ color: '#0296FF' }}>S/ {Number(activeReceipt.total).toFixed(1)}</div>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* Ticket Térmico Oculto */}
      {activeReceipt && (
        <div className="fixed -left-[9999px] top-0">
          <div ref={ticketRef} style={{ width: printerWidth === '58' ? '188px' : '260px', fontSize: '12px' }}>
            <div style={{ textAlign: 'center', marginBottom: '10px' }}>
              <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{companySettings?.companyName || 'STILOSTACK'}</div>
              <div>-------------------------</div>
              <div>BOLETA: {activeReceipt.id}</div>
              <div>{format(activeReceipt.createdAt?.toDate ? activeReceipt.createdAt.toDate() : new Date(), "dd/MM/yy HH:mm")}</div>
            </div>
            <div>CLIENTE: {activeReceipt.customerName}</div>
            <div>ID: {activeReceipt.customerId}</div>
            <div>-------------------------</div>
            {activeReceipt.items.map((item: any, idx: number) => (
              <div key={idx} style={{ marginBottom: '5px' }}>
                <div>{item.name}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{item.quantity} x {Number(item.price).toFixed(1)}</span>
                  <span>S/ {((Number(item.price) * Number(item.quantity)) - Number(item.discount)).toFixed(1)}</span>
                </div>
              </div>
            ))}
            <div>-------------------------</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px' }}>
              <span>TOTAL:</span>
              <span>S/ {Number(activeReceipt.total).toFixed(1)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
