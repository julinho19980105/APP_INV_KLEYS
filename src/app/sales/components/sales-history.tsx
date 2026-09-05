
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
  Filter,
  Truck
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
import { format, startOfMonth, subMonths, startOfYear } from "date-fns"
import { es } from "date-fns/locale"

export default function SalesHistory() {
  const router = useRouter()
  const db = useFirestore()
  const { toast } = useToast()
  
  const [searchQuery, setSearchQuery] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<string>("active")
  const [timeFilter, setTimeFilter] = React.useState<string>("1m")
  const [daysLimit, setDaysLimit] = React.useState(30)
  const [activeReceipt, setActiveReceipt] = React.useState<any>(null)
  const [printerChar, setPrinterChar] = React.useState<any>(null)
  const [expandedSales, setExpandedSales] = React.useState<Record<string, boolean>>({})

  const receiptRef = React.useRef<HTMLDivElement>(null)
  
  const configDocRef = React.useMemo(() => db ? doc(db, "config", "global") : null, [db])
  const { data: companySettings } = useDoc(configDocRef)
  const brandColor = companySettings?.brandColor || "#0296FF"

  const dateLimit = React.useMemo(() => {
    const now = new Date()
    if (timeFilter === "1m") return startOfMonth(now)
    if (timeFilter === "2m") return startOfMonth(subMonths(now, 1))
    if (timeFilter === "3m") return startOfMonth(subMonths(now, 2))
    if (timeFilter === "year") return startOfYear(now)
    return null 
  }, [timeFilter])

  const quotesRef = React.useMemo(() => {
    if (!db) return null
    if (dateLimit) {
      return query(
        collection(db, "quotes"), 
        where("createdAt", ">=", dateLimit),
        orderBy("createdAt", "desc")
      )
    }
    return query(
      collection(db, "quotes"), 
      orderBy("createdAt", "desc"),
      limit(200)
    )
  }, [db, dateLimit])

  const { data: quotes = [], loading } = useCollection(quotesRef)

  const stats = React.useMemo(() => {
    const periodQuotes = quotes.filter(q => q.status !== 'annulled')
    const total = periodQuotes.reduce((acc, q) => acc + (q.total || 0), 0)
    const abonos = total * 0.89 
    const deuda = total - abonos
    return { total, abonos, deuda, count: periodQuotes.length }
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
      let dateObj: Date;
      if (sale.date) {
        dateObj = new Date(sale.date + "T12:00:00");
      } else {
        dateObj = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date();
      }
      
      const dayLabel = format(dateObj, "EEEE d MMMM", { locale: es }).toUpperCase()
      const dayKey = format(dateObj, "yyyy-MM-dd")
      
      if (!groups[dayKey]) groups[dayKey] = { dateLabel: dayLabel, dateKey: dayKey, sales: [], dayTotal: 0 }
      groups[dayKey].sales.push(sale)
      if (sale.status !== 'annulled') groups[dayKey].dayTotal += (sale.total || 0)
    })
    return Object.values(groups).sort((a, b) => b.dateKey.localeCompare(a.dateKey))
  }, [filteredQuotes])

  const toggleExpand = (id: string) => {
    setExpandedSales(prev => ({ ...prev, [id]: !prev[id] }))
  }

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
          const dataUrl = await toJpeg(receiptRef.current, { quality: 0.95, pixelRatio: 2, backgroundColor: '#FFFFFF' })
          const blob = await (await fetch(dataUrl)).blob()
          const file = new File([blob], `Venta-${sale.id}.jpg`, { type: 'image/jpeg' })
          if (navigator.share) await navigator.share({ files: [file] })
          else { const link = document.createElement('a'); link.download = `Venta-${sale.id}.jpg`; link.href = dataUrl; link.click(); }
        } catch (err) { toast({ variant: "destructive", title: "Error de imagen" }) }
        finally { setActiveReceipt(null) }
      }
    }, 500)
  }

  const connectPrinter = async (saleToPrint?: any) => {
    try {
      if (!navigator.bluetooth) {
        toast({ variant: "destructive", title: "BLUETOOTH NO SOPORTADO", description: "Use un navegador compatible (Chrome/Edge)." })
        return null
      }
      
      const device = await navigator.bluetooth.requestDevice({
        filters: [
          { services: ['000018f0-0000-1000-8000-00805f9b34fb'] },
          { services: ['0000ff00-0000-1000-8000-00805f9b34fb'] },
          { namePrefix: 'Printer' },
          { namePrefix: 'Thermal' },
          { namePrefix: 'MPT' },
          { namePrefix: 'RP' },
          { namePrefix: 'Blue' },
          { namePrefix: 'POS' },
          { namePrefix: 'MTP' },
          { namePrefix: 'BT Printer' },
          { namePrefix: 'MTP-II' }
        ],
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb', 
          '0000ff00-0000-1000-8000-00805f9b34fb',
          '49535343-fe7d-4ae5-8fa9-9fafd205e455'
        ]
      })
      
      const server = await device.gatt?.connect()
      const services = await server?.getPrimaryServices()
      if (!services) return null
      
      for (const service of services) {
        const characteristics = await service.getCharacteristics()
        for (const char of characteristics) {
          if (char.properties.write || char.properties.writeWithoutResponse) {
            setPrinterChar(char)
            toast({ title: "IMPRESORA VINCULADA" })
            if (saleToPrint) {
              setTimeout(() => printTicket(saleToPrint, char), 800);
            }
            return char
          }
        }
      }
      return null
    } catch (error) {
      toast({ variant: "destructive", title: "ERROR DE CONEXIÓN" })
      return null
    }
  }

  const printTicket = async (sale: any, existingChar?: any) => {
    let char = existingChar || printerChar;
    if (!char) {
      char = await connectPrinter(sale)
      return
    }

    try {
      const clean = (str: string) => {
        if (!str) return "";
        return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ñ/g, "n").replace(/Ñ/g, "N");
      };

      const encoder = new TextEncoder()
      const init = '\x1B\x40'
      const center = '\x1B\x61\x01'
      const left = '\x1B\x61\x00'
      const right = '\x1B\x61\x02'
      const boldOn = '\x1B\x45\x01'
      const boldOff = '\x1B\x45\x00'
      const size100 = '\x1D\x21\x00' 
      const size200 = '\x1D\x21\x11' 
      const size300 = '\x1D\x21\x22' 
      const line = '------------------------------------------------\n' 

      let data = init + center
      data += boldOn + size100 + clean(companySettings?.companyName || 'STILOSTACK').toUpperCase() + '\n' + boldOff
      data += line
      
      const labelBI = "BOLETA INTERNA"
      const idStr = sale.id
      const spacesHeader = Math.max(1, 48 - labelBI.length - idStr.length)
      data += left + size100 + boldOn + labelBI + ' '.repeat(spacesHeader) + idStr + '\n'
      
      const displayDate = sale.date ? format(new Date(sale.date + "T12:00:00"), "dd/MM/yy") : format(sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date(), "dd/MM/yy");
      data += right + size100 + displayDate + '\n' + boldOff
      
      data += line
      
      data += left + size300 + boldOn + clean(sale.customerName || 'CLIENTE').toUpperCase() + '\n' + boldOff
      data += size100 + `ID: ${sale.customerId}\n`
      data += line
      
      sale.items.forEach((item: any, idx: number) => {
        const indexStr = `${idx + 1}- `
        data += indexStr + clean(item.name).toUpperCase() + '\n'
        
        const padding = ' '.repeat(indexStr.length)
        const qtyPrice = `${padding}${item.quantity} x S/ ${Number(item.price).toFixed(1)}`
        const itemTotalStr = `S/ ${((Number(item.price) * Number(item.quantity)) - (Number(item.discount) || 0)).toFixed(1)}`
        
        const spaces = Math.max(1, 48 - qtyPrice.length - itemTotalStr.length)
        data += qtyPrice + ' '.repeat(spaces) + itemTotalStr + '\n'
        
        if (item.description) {
          data += `${padding}(${clean(item.description)})\n`
        }
      })
      
      data += line
      
      const totalQtyNum = (sale.items || []).reduce((acc: number, i: any) => acc + Number(i.quantity), 0)
      const totalAmtStr = `S/ ${Number(sale.total).toFixed(1)}`
      const totalQtyStr = `${totalQtyNum} UND`
      
      const spacesTotal = Math.max(1, 16 - totalQtyStr.length - totalAmtStr.length)
      data += left + size300 + boldOn + totalQtyStr + ' '.repeat(spacesTotal) + totalAmtStr + '\n' + boldOff
      
      data += '\n' + center + size100 + "GRACIAS POR SU COMPRA\n"
      data += '\n\n\n\n'

      const buffer = encoder.encode(data)
      for (let i = 0; i < buffer.length; i += 20) {
        await char.writeValue(buffer.slice(i, i + 20))
      }
      toast({ title: "TICKET IMPRESO" })
    } catch (error) {
      setPrinterChar(null)
      toast({ variant: "destructive", title: "ERROR DE IMPRESIÓN" })
    }
  }

  return (
    <div className="space-y-3 pt-1 animate-in fade-in duration-500 px-1 md:px-0">
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-[#0f172a] py-3 px-4 rounded-2xl flex flex-col shadow-lg relative overflow-hidden">
          <TrendingUp className="absolute right-[-4px] top-1 opacity-10 w-12 h-12 text-white" />
          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none">TOTAL (PERIODO)</span>
          <div className="text-[16px] font-headline font-black text-white mt-1 leading-none">S/ {stats.total.toFixed(1)}</div>
        </div>
        <div className="bg-white border border-slate-300 py-3 px-4 rounded-2xl flex flex-col shadow-sm">
          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none">ABONOS (EST.)</span>
          <div className="text-[16px] font-headline font-black text-[#10b981] mt-1 leading-none">S/ {stats.abonos.toFixed(1)}</div>
        </div>
        <div className="bg-white border border-slate-300 py-3 px-4 rounded-2xl flex flex-col shadow-sm">
          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none">DEUDA (EST.)</span>
          <div className="text-[16px] font-headline font-black text-red-500 mt-1 leading-none">S/ {stats.deuda.toFixed(1)}</div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
          <Input 
            placeholder="BUSCAR POR CLIENTE O CÓDIGO..." 
            className="h-11 pl-12 bg-slate-50/50 border-slate-300 rounded-xl font-medium text-[10px] uppercase text-slate-700 shadow-inner"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Select value={timeFilter} onValueChange={setTimeFilter}>
            <SelectTrigger className="h-11 rounded-xl border-slate-300 font-bold text-[9px] uppercase gap-2 text-slate-600 bg-white">
               <div className="flex items-center gap-2">
                <CalendarDays className="w-3.5 h-3.5 text-primary" />
                <SelectValue placeholder="Periodo" />
              </div>
            </SelectTrigger>
            <SelectContent className="rounded-xl border-slate-300 shadow-2xl">
              <SelectItem value="1m" className="text-[9px] font-bold uppercase">Mes Actual</SelectItem>
              <SelectItem value="2m" className="text-[9px] font-bold uppercase">2 Meses (Este y Anterior)</SelectItem>
              <SelectItem value="3m" className="text-[9px] font-bold uppercase">3 Meses</SelectItem>
              <SelectItem value="year" className="text-[9px] font-bold uppercase">Año Entero</SelectItem>
              <SelectItem value="all" className="text-[9px] font-bold uppercase">Historial Completo</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-11 rounded-xl border-slate-300 font-bold text-[9px] uppercase gap-2 text-slate-600 bg-white">
              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-primary" />
                <SelectValue placeholder="Estado" />
              </div>
            </SelectTrigger>
            <SelectContent className="rounded-xl border-slate-300 shadow-2xl">
              <SelectItem value="all" className="text-[9px] font-bold uppercase">Todos</SelectItem>
              <SelectItem value="active" className="text-[9px] font-bold uppercase">Activos</SelectItem>
              <SelectItem value="shipped" className="text-[9px] font-bold uppercase">Enviados</SelectItem>
              <SelectItem value="annulled" className="text-[9px] font-bold uppercase">Anulados</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-3 pt-1">
        {loading && (
          <div className="text-center p-20 opacity-30">
            <Loader2 className="w-8 h-8 animate-spin mx-auto" />
          </div>
        )}
        
        {groupedSales.map(group => (
          <div key={group.dateKey} className="space-y-1">
            <div className="bg-[#1e293b] px-5 py-2 rounded-xl flex justify-between items-center shadow-md border border-slate-800">
              <span className="text-[9px] font-bold uppercase text-slate-100 tracking-widest">{group.dateLabel}</span>
              <span className="font-headline font-black text-[13px] text-[#10b981]">S/{group.dayTotal.toFixed(1)}</span>
            </div>
            <div className="space-y-1 px-1">
              {group.sales.map(s => {
                const isExpanded = expandedSales[s.id] || false;
                return (
                  <div key={s.id} className="bg-white border border-slate-300 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all">
                    <div className={cn(
                      "p-3 flex justify-between items-center",
                      s.status === 'annulled' && "opacity-40 grayscale bg-slate-50"
                    )}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <button 
                            className="flex items-center gap-1 group/id hover:text-primary transition-colors"
                            onClick={() => toggleExpand(s.id)}
                          >
                            <span className="text-[10px] font-black text-primary/70 uppercase tracking-tighter">{s.id}</span>
                            <ChevronDown className={cn("w-3.5 h-3.5 text-slate-300 transition-transform group-hover/id:text-primary", isExpanded && "rotate-180")} />
                          </button>
                          {s.status === 'shipped' && (
                            <Badge className="bg-primary/10 text-primary text-[7px] font-bold h-4 px-1.5 border-none flex items-center gap-1">
                              <Truck className="w-2 h-2" /> ENVIADO
                            </Badge>
                          )}
                        </div>
                        <div className="text-[12px] font-normal text-slate-900 uppercase truncate leading-tight">{s.customerName}</div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="font-headline font-black text-[14px] text-slate-900 leading-none">S/{Number(s.total).toFixed(1)}</div>
                          <div className="text-[8px] font-bold text-slate-400 uppercase mt-1">{(s.items || []).reduce((acc: number, i: any) => acc + Number(i.quantity), 0)} UND</div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="h-10 w-10 flex items-center justify-center text-slate-300 hover:text-primary transition-all">
                              <MoreVertical className="w-4.5 h-4.5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-2xl p-2 w-48 shadow-2xl border-slate-300">
                            <DropdownMenuItem className="text-[10px] font-bold uppercase gap-3 p-3 rounded-xl" onClick={() => printTicket(s)}>
                              <Printer className="w-4 h-4 text-[#10b981]" /> {printerChar ? "Imprimir Ticket" : "Conectar Impresora"}
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-[10px] font-bold uppercase gap-3 p-3 rounded-xl" onClick={() => shareReceipt(s)}>
                              <Share2 className="w-4 h-4 text-blue-500" /> Compartir Imagen
                            </DropdownMenuItem>
                            {s.status === 'active' && (
                              <DropdownMenuItem className="text-[10px] font-bold uppercase gap-3 p-3 rounded-xl" onClick={() => router.push(`/sales?edit=${s.id}&tab=quotes`)}>
                                <Edit2 className="w-4 h-4 text-primary" /> Editar Venta
                              </DropdownMenuItem>
                            )}
                            {s.status !== 'annulled' && (
                              <DropdownMenuItem className="text-[10px] font-bold uppercase gap-3 p-3 rounded-xl text-red-500" onClick={() => handleAnnul(s)}>
                                <Ban className="w-4 h-4" /> Anular Venta
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 bg-slate-50/50 border-t border-slate-100 animate-in slide-in-from-top-1 duration-200">
                        <div className="space-y-2">
                           <div className="flex items-center gap-2 mb-2">
                             <div className="w-1 h-3 bg-primary rounded-full" />
                             <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Desglose de Productos</span>
                           </div>
                           {s.items.map((item: any, idx: number) => (
                             <div key={idx} className="flex justify-between items-start py-2 border-b border-slate-200 last:border-0">
                               <div className="flex-1 min-w-0 pr-4">
                                 <div className="text-[10px] font-black text-slate-800 uppercase truncate">{item.name}</div>
                                 {item.description && <div className="text-[8px] font-medium text-slate-400 uppercase mt-0.5 line-clamp-1 italic">({item.description})</div>}
                               </div>
                               <div className="text-right shrink-0">
                                 <div className="text-[9px] font-bold text-slate-500">
                                   <span className="text-primary">{item.quantity}</span> x S/ {Number(item.price).toFixed(1)}
                                 </div>
                                 <div className="text-[11px] font-headline font-black text-slate-900 mt-0.5">
                                   S/ {((Number(item.price) * Number(item.quantity)) - (Number(item.discount) || 0)).toFixed(1)}
                                 </div>
                               </div>
                             </div>
                           ))}
                           <div className="pt-2 flex justify-between items-center border-t border-slate-300 mt-2">
                              <span className="text-[9px] font-black text-slate-400 uppercase">Total de Prendas</span>
                              <span className="text-[12px] font-headline font-black text-slate-900">{(s.items || []).reduce((acc: number, i: any) => acc + Number(i.quantity), 0)} UND</span>
                           </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {!loading && groupedSales.length > 0 && (
          <div className="flex justify-center pt-4 pb-8">
            <Button 
              variant="ghost" 
              className="h-10 rounded-xl font-bold text-[9px] uppercase tracking-widest text-slate-400"
              onClick={() => setDaysLimit(prev => prev + 15)}
            >
              <ChevronDown className="w-4 h-4 mr-2" /> CARGAR MÁS REGISTROS
            </Button>
          </div>
        )}
      </div>

      {activeReceipt && (
        <div className="fixed -left-[9999px] top-0">
          <div ref={receiptRef} style={{
            width: '820px',
            background: '#ffffff',
            padding: '30px',
            fontFamily: 'Arial, sans-serif',
            color: '#000000',
            boxSizing: 'border-box'
          }}>
            <div style={{
              border: '2px solid #000000',
              borderRadius: '8px',
              overflow: 'hidden',
              backgroundColor: '#ffffff'
            }}>
              {/* CABECERA */}
              <div style={{
                padding: '26px 34px 24px',
                borderBottom: '2px solid #000000',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontSize: '31px', fontWeight: 700, lineHeight: 1, letterSpacing: '-0.8px' }}>
                    {companySettings?.companyName || 'KLEYS KIDS'}
                  </div>
                  <div style={{ marginTop: '8px', fontSize: '13px', fontWeight: 600, letterSpacing: '1px' }}>
                    BOLETA INTERNA
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '27px', fontWeight: 700, lineHeight: 1 }}>
                    {activeReceipt.id}
                  </div>
                  <div style={{ marginTop: '7px', fontSize: '10px', fontWeight: 600, letterSpacing: '0.8px' }}>
                    N.º DE BOLETA
                  </div>
                </div>
              </div>

              {/* INFORMACIÓN CLIENTE / FECHA */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 220px',
                gap: '35px',
                padding: '26px 34px 28px'
              }}>
                <div>
                  <div style={{ marginBottom: '7px', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' }}>
                    Cliente
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 600, lineHeight: 1.15 }}>
                    {activeReceipt.customerName}
                  </div>
                  <div style={{ marginTop: '5px', fontSize: '13px', fontWeight: 400 }}>
                    {activeReceipt.customerId}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ marginBottom: '7px', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' }}>
                    Fecha
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 600 }}>
                    {activeReceipt.date ? 
                      format(new Date(activeReceipt.date + "T12:00:00"), "dd/MM/yyyy") :
                      format(activeReceipt.createdAt?.toDate ? activeReceipt.createdAt.toDate() : new Date(), "dd/MM/yyyy")
                    }
                  </div>
                </div>
              </div>

              {/* TABLA PRODUCTOS */}
              <div style={{ padding: '0 34px' }}>
                <div style={{
                  padding: '12px 16px',
                  backgroundColor: '#64ABB9',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  borderRadius: '7px 7px 0 0'
                }}>
                  Detalle de productos
                </div>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  border: '1.5px solid #000000',
                  borderTop: 'none'
                }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #000000' }}>
                      <th style={{ padding: '12px 9px', fontSize: '12px', fontWeight: 700, textAlign: 'center', width: '48px' }}>N.º</th>
                      <th style={{ padding: '12px 9px', fontSize: '12px', fontWeight: 700, textAlign: 'left' }}>Producto</th>
                      <th style={{ padding: '12px 9px', fontSize: '12px', fontWeight: 700, textAlign: 'right', width: '90px' }}>P.U.</th>
                      <th style={{ padding: '12px 9px', fontSize: '12px', fontWeight: 700, textAlign: 'right', width: '70px' }}>Cant.</th>
                      <th style={{ padding: '12px 9px', fontSize: '12px', fontWeight: 700, textAlign: 'right', width: '100px' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeReceipt.items.map((item: any, idx: number) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #000000' }}>
                        <td style={{ padding: '15px 9px', fontSize: '14px', fontWeight: 600, textAlign: 'center' }}>{idx + 1}</td>
                        <td style={{ padding: '15px 9px' }}>
                          <div style={{ fontSize: '14px', fontWeight: 600 }}>{item.name}</div>
                          {item.description && (
                            <div style={{ marginTop: '4px', fontSize: '13px', fontWeight: 400 }}>{item.description}</div>
                          )}
                        </td>
                        <td style={{ padding: '15px 9px', fontSize: '14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          S/ {Number(item.price).toFixed(2)}
                        </td>
                        <td style={{ padding: '15px 9px', fontSize: '14px', textAlign: 'right' }}>{item.quantity}</td>
                        <td style={{ padding: '15px 9px', fontSize: '14px', fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap' }}>
                          S/ {((Number(item.price) * Number(item.quantity)) - (Number(item.discount) || 0)).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* RESUMEN FINAL */}
              <div style={{
                margin: '30px 34px 0',
                padding: '25px 0',
                borderTop: '2px solid #000000',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end'
              }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' }}>
                    Cantidad total
                  </div>
                  <div style={{ marginTop: '5px', fontSize: '29px', fontWeight: 600 }}>
                    {activeReceipt.items.reduce((acc: number, i: any) => acc + Number(i.quantity), 0)} UND
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase' }}>
                    Saldo total
                  </div>
                  <div style={{ marginTop: '4px', fontSize: '46px', fontWeight: 500, color: '#64ABB9', letterSpacing: '-1.5px' }}>
                    S/ {Number(activeReceipt.total).toFixed(2)}
                  </div>
                </div>
              </div>

              {/* PIE */}
              <div style={{
                margin: '0 34px',
                padding: '15px 0 20px',
                borderTop: '1px solid #000000',
                textAlign: 'center',
                fontSize: '11px',
                fontWeight: 400
              }}>
                {companySettings?.companyName || 'KLEYS KIDS'} · BOLETA INTERNA
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
