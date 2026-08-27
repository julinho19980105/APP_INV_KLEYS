
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
  Share2
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
import { format } from "date-fns"
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

  const filteredQuotes = React.useMemo(() => {
    const q = searchQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    return quotes.filter(s => {
      const matchesSearch = s.id.toLowerCase().includes(q) || s.customerName?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q)
      let matchesStatus = statusFilter === "all" ? true : s.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [quotes, searchQuery, statusFilter])

  const groupedSales = React.useMemo(() => {
    const groups: Record<string, { dateLabel: string, sales: any[], dayTotal: number }> = {}
    filteredQuotes.forEach(sale => {
      const date = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date()
      const dayLabel = format(date, "EEEE d 'de' MMMM", { locale: es }).toUpperCase()
      if (!groups[dayLabel]) groups[dayLabel] = { dateLabel: dayLabel, sales: [], dayTotal: 0 }
      groups[dayLabel].sales.push(sale)
      if (sale.status !== 'annulled') groups[dayLabel].dayTotal += (sale.total || 0)
    })
    return Object.values(groups)
  }, [filteredQuotes])

  const handleAnnul = async (sale: any) => {
    if (!db || !confirm(`¿ANULAR VENTA ${sale.id}?`)) return
    
    try {
      await updateDoc(doc(db, "quotes", sale.id), { status: 'annulled' })
      
      for (const item of (sale.items || [])) {
        if (item.isRegistered && item.productId !== "MANUAL") {
          const prodRef = doc(db, "products", item.productId)
          updateDoc(prodRef, {
            stock: increment(Number(item.quantity)),
            updatedAt: serverTimestamp()
          }).catch(() => {});

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
      toast({ title: "VENTA ANULADA Y STOCK REINTEGRADO" })
    } catch (e) {
      toast({ variant: "destructive", title: "ERROR AL ANULAR" })
    }
  }

  const shareReceipt = async (sale: any) => {
    setActiveReceipt(sale)
    setTimeout(async () => {
      if (receiptRef.current) {
        try {
          const dataUrl = await toJpeg(receiptRef.current, { 
            quality: 1, 
            pixelRatio: 3,
            backgroundColor: '#FFFFFF' 
          })
          const blob = await (await fetch(dataUrl)).blob()
          const file = new File([blob], `Venta-${sale.id}.jpg`, { type: 'image/jpeg' })
          
          if (navigator.share) {
            await navigator.share({
              files: [file]
            })
          } else {
            const link = document.createElement('a')
            link.download = `Venta-${sale.id}.jpg`
            link.href = dataUrl
            link.click()
          }
        } catch (err) {
          toast({ variant: "destructive", title: "Error al generar imagen" })
        } finally {
          setActiveReceipt(null)
        }
      }
    }, 500)
  }

  const printTicket = async (sale: any) => {
    setActiveReceipt(sale)
    setTimeout(() => {
      const printWindow = window.open('', '_blank');
      if (printWindow && ticketRef.current) {
        printWindow.document.write('<html><head><title>TICKET</title>');
        printWindow.document.write('<style>body{margin:0;padding:0;font-family:monospace;font-weight:bold;}</style>');
        printWindow.document.write('</head><body>');
        printWindow.document.write(ticketRef.current.innerHTML);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        printWindow.close();
      }
      setActiveReceipt(null);
    }, 300);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-primary/10 pb-6">
        <div className="flex w-full md:w-auto gap-2">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-3 h-4 w-4 text-primary/40" />
            <Input 
              placeholder="BUSCAR VENTA..." 
              className="pl-9 h-10 rounded-xl border-primary/10 font-black text-[11px] uppercase bg-white shadow-sm"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px] h-10 rounded-xl border-primary/10 font-black text-[9px] uppercase bg-white">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all" className="text-[9px] font-black uppercase">Todos</SelectItem>
              <SelectItem value="active" className="text-[9px] font-black uppercase">Activos</SelectItem>
              <SelectItem value="shipped" className="text-[9px] font-black uppercase">Enviados</SelectItem>
              <SelectItem value="annulled" className="text-[9px] font-black uppercase">Anulados</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-6">
        {loading && (
          <div className="text-center p-20 opacity-30">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
            <span className="text-[10px] font-black uppercase tracking-widest">Sincronizando Historial...</span>
          </div>
        )}
        
        {groupedSales.length === 0 && !loading && (
          <div className="p-20 text-center opacity-20 font-black text-[10px] uppercase border-2 border-dashed rounded-[2rem]">
            No se encontraron ventas recientes
          </div>
        )}

        {groupedSales.map(group => (
          <div key={group.dateLabel} className="space-y-2">
            <div className="flex justify-between items-center px-4 py-2 bg-primary/5 rounded-lg border border-primary/10">
              <span className="text-[9px] font-black uppercase text-primary tracking-widest">{group.dateLabel}</span>
              <span className="font-headline font-black text-sm">S/ {group.dayTotal.toFixed(1)}</span>
            </div>
            <div className="space-y-1.5">
              {group.sales.map(s => (
                <Card key={s.id} className={cn("rounded-xl border border-primary/5 bg-white shadow-sm hover:shadow-md transition-all", s.status === 'annulled' && "opacity-30")}>
                  <CardContent className="p-3 flex justify-between items-center">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-[10px] text-foreground uppercase truncate">{s.id}</span>
                        <Badge variant="outline" className={cn(
                          "text-[7px] font-black h-4 px-2 uppercase border-none rounded-md",
                          s.status === 'active' ? "bg-green-50 text-green-600" :
                          s.status === 'shipped' ? "bg-blue-50 text-blue-600" :
                          "bg-red-50 text-red-600"
                        )}>
                          {s.status === 'annulled' ? 'ANULADO' : s.status === 'shipped' ? 'ENVIADO' : 'ACTIVO'}
                        </Badge>
                      </div>
                      <div className="text-[11px] font-medium text-foreground uppercase mt-0.5 truncate">{s.customerName}</div>
                    </div>
                    <div className="text-right flex items-center gap-4 ml-4">
                      <div className="font-headline font-black text-base text-foreground whitespace-nowrap">S/ {Number(s.total).toFixed(1)}</div>
                      <DropdownMenu>
                         <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-primary"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                         <DropdownMenuContent align="end" className="rounded-xl p-1.5 w-48 shadow-xl">
                            <DropdownMenuItem className="text-[10px] font-black uppercase gap-2.5 p-2.5" onClick={() => printTicket(s)}>
                               <Printer className="w-3.5 h-3.5 text-green-600" /> Imprimir Ticket
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-[10px] font-black uppercase gap-2.5 p-2.5" onClick={() => shareReceipt(s)}>
                               <Share2 className="w-3.5 h-3.5 text-blue-500" /> Compartir Imagen
                            </DropdownMenuItem>
                            {s.status === 'active' && (
                              <DropdownMenuItem className="text-[10px] font-black uppercase gap-2.5 p-2.5" onClick={() => router.push(`/sales?edit=${s.id}&tab=quotes`)}>
                                 <Edit2 className="w-3.5 h-3.5 text-primary" /> Editar Venta
                              </DropdownMenuItem>
                            )}
                            {s.status !== 'annulled' && s.status !== 'shipped' && (
                              <DropdownMenuItem className="text-[10px] font-black uppercase gap-2.5 p-2.5 text-destructive" onClick={() => handleAnnul(s)}>
                                 <Ban className="w-3.5 h-3.5" /> Anular Venta
                              </DropdownMenuItem>
                            )}
                         </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}

        {!loading && groupedSales.length > 0 && (
          <div className="flex justify-center pt-6 pb-12">
            <Button 
              variant="outline" 
              className="h-10 rounded-xl border-primary/20 text-primary font-black uppercase text-[9px] tracking-[0.2em] px-8 bg-white shadow-sm hover:bg-primary/5"
              onClick={() => setDaysLimit(prev => prev + 15)}
            >
              <ChevronDown className="w-4 h-4 mr-2" /> Cargar 15 días anteriores
            </Button>
          </div>
        )}
      </div>

      {/* Templates para Compartir e Impresión (Ocultos) */}
      {activeReceipt && (
        <div className="fixed -left-[4000px] top-0">
          <div ref={receiptRef} className="w-[800px] bg-white p-16 flex flex-col gap-10 text-black" style={{ fontFamily: 'var(--font-space)' }}>
            <div className="flex justify-between items-end border-b-8 border-black pb-8">
              <h1 className="text-7xl font-black uppercase tracking-tighter" style={{ color: '#0296FF' }}>{companySettings?.companyName || 'STILOSTACK'}</h1>
              <div className="text-7xl font-black text-black">{activeReceipt.id}</div>
            </div>
            <div className="flex justify-between items-start bg-white py-4">
              <div className="flex flex-col gap-2">
                <div className="text-[28px] font-black uppercase">CLIENTE</div>
                <div className="text-[32px] font-black uppercase">{activeReceipt.customerName}</div>
                <div className="text-[32px] font-black uppercase text-black/60">{activeReceipt.customerId}</div>
              </div>
              <div className="text-right">
                <div className="text-[28px] font-black uppercase">{format(activeReceipt.createdAt?.toDate ? activeReceipt.createdAt.toDate() : new Date(), "d 'de' MMMM, yyyy", { locale: es }).toUpperCase()}</div>
              </div>
            </div>
            <div className="mt-4">
              <table className="w-full">
                <thead>
                  <tr className="border-b-4 border-black text-left">
                    <th className="py-5 text-[14px] font-black uppercase w-10">#</th>
                    <th className="py-5 text-[14px] font-black uppercase">PRENDA</th>
                    <th className="py-5 text-[14px] font-black uppercase text-center">P. UNIT</th>
                    <th className="py-5 text-[14px] font-black uppercase text-center">CANT</th>
                    <th className="py-5 text-[14px] font-black uppercase text-right">SUBTOTAL</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-black/10">
                  {activeReceipt.items.map((item: any, idx: number) => (
                    <tr key={idx} className="h-20">
                      <td className="text-[16px] font-black text-black/30">{idx + 1}-</td>
                      <td className="py-4">
                        <div className="text-[18px] font-black uppercase leading-tight">{item.name}</div>
                        <div className="text-[12px] font-bold text-black/50">{item.description}</div>
                      </td>
                      <td className="text-[16px] font-black text-center">S/ {Number(item.price).toFixed(1)}</td>
                      <td className="text-[16px] font-black text-center">{item.quantity}</td>
                      <td className="text-[20px] font-black text-right">S/ {((Number(item.price) * Number(item.quantity)) - Number(item.discount)).toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-8 w-full border-t-8 border-black pt-8">
              <div className="flex justify-between items-start">
                <div className="flex flex-col gap-1">
                  <div className="text-[22px] font-black uppercase text-black/60">TOTAL CANTIDAD</div>
                  <div className="text-[44px] font-black uppercase">{activeReceipt.items.reduce((acc: number, i: any) => acc + Number(i.quantity), 0)} UNID</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="text-[28px] font-black uppercase text-black/60">TOTAL SOLES</div>
                  <div className="text-[80px] font-black leading-none" style={{ color: '#0296FF' }}>S/ {Number(activeReceipt.total).toFixed(1)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeReceipt && (
        <div className="fixed -left-[2000px] top-0">
          <div ref={ticketRef} style={{ width: printerWidth === '58' ? '188px' : '260px', fontSize: '10px', padding: '5px' }}>
            <div style={{ textAlign: 'center', marginBottom: '10px' }}>
              <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{companySettings?.companyName || 'STILOSTACK'}</div>
              <div>--------------------------------</div>
              <div>BOLETA: {activeReceipt.id}</div>
              <div>FECHA: {format(activeReceipt.createdAt?.toDate ? activeReceipt.createdAt.toDate() : new Date(), "dd/MM/yy HH:mm")}</div>
            </div>
            <div>CLIENTE: {activeReceipt.customerName}</div>
            <div>ID: {activeReceipt.customerId}</div>
            <div>--------------------------------</div>
            {activeReceipt.items.map((item: any, idx: number) => (
              <div key={idx} style={{ marginBottom: '5px' }}>
                <div>{idx + 1}- {item.name}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{item.quantity} x {Number(item.price).toFixed(1)}</span>
                  <span>S/ {((Number(item.price) * Number(item.quantity)) - Number(item.discount)).toFixed(1)}</span>
                </div>
              </div>
            ))}
            <div>--------------------------------</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
              <span>CANT TOTAL:</span>
              <span>{activeReceipt.items.reduce((acc: number, i: any) => acc + Number(i.quantity), 0)} UND</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 'bold', marginTop: '5px' }}>
              <span>TOTAL:</span>
              <span>S/ {Number(activeReceipt.total).toFixed(1)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
