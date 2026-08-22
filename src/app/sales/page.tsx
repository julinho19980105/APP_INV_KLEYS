
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
  Loader2
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

export default function SalesPage() {
  const router = useRouter()
  const db = useFirestore()
  const { toast } = useToast()
  
  const [searchQuery, setSearchQuery] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<string>("all")
  const [confirmAnnulId, setConfirmAnnulId] = React.useState<string | null>(null)
  const [activeReceipt, setActiveReceipt] = React.useState<any>(null)
  const [showHistorical, setShowHistorical] = React.useState(false)
  const receiptRef = React.useRef<HTMLDivElement>(null)
  
  const configDocRef = React.useMemo(() => db ? doc(db, "config", "global") : null, [db])
  const { data: companySettings } = useDoc(configDocRef)
  const brandColor = companySettings?.brandColor || "#FF3399"

  const quotesRef = React.useMemo(() => {
    if (!db) return null
    if (showHistorical) {
      return query(collection(db, "quotes"), orderBy("createdAt", "desc"), limit(200))
    }
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    return query(
      collection(db, "quotes"), 
      where("createdAt", ">=", startOfMonth),
      orderBy("createdAt", "desc")
    )
  }, [db, showHistorical])

  const { data: quotes = [], loading } = useCollection(quotesRef)

  const currentMonthTotal = React.useMemo(() => {
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()
    return quotes
      .filter(q => {
        const date = q.createdAt?.toDate ? q.createdAt.toDate() : new Date()
        const isThisMonth = date.getMonth() === currentMonth && date.getFullYear() === currentYear
        return q.status === 'active' && isThisMonth
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

  const handleSendImage = async (sale: any) => {
    setActiveReceipt(sale)
    setTimeout(async () => {
      if (receiptRef.current) {
        try {
          const dataUrl = await toJpeg(receiptRef.current, { quality: 0.95, backgroundColor: '#ffffff' })
          const blob = await (await fetch(dataUrl)).blob()
          const file = new File([blob], `Boleta_${sale.id}.jpg`, { type: 'image/jpeg' })
          if (navigator.share) await navigator.share({ files: [file], title: `Boleta ${sale.id}` })
          else {
            const link = document.createElement('a')
            link.download = `Boleta_${sale.id}.jpg`
            link.href = dataUrl
            link.click()
          }
        } catch (err) { toast({ variant: "destructive", title: "ERROR" }) }
      }
    }, 400)
  }

  return (
    <div className="space-y-6 pt-2 pb-20 max-w-4xl mx-auto px-2 md:px-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-primary/10 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20" style={{ backgroundColor: brandColor }}>
            <ShoppingBag className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-0.5">Ventas del Mes</h1>
            <div className="font-headline font-black text-3xl md:text-4xl text-foreground tracking-tighter">
              S/ {currentMonthTotal.toFixed(2)}
            </div>
          </div>
        </div>
        <div className="flex w-full md:w-auto gap-2">
          <div className="relative flex-1 md:w-60">
            <Search className="absolute left-3.5 top-3.5 h-4 w-4" style={{ color: brandColor }} />
            <Input 
              placeholder="" 
              className="pl-10 h-10 rounded-xl border-primary/10 font-black text-xs uppercase bg-white shadow-sm"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[120px] h-10 rounded-xl border-primary/10 font-black text-[10px] uppercase bg-white">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all" className="text-[10px] font-black uppercase">Todos</SelectItem>
              <SelectItem value="active" className="text-[10px] font-black uppercase">Ventas</SelectItem>
              <SelectItem value="annulled" className="text-[10px] font-black uppercase">Anulados</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-6">
        {loading && (
          <div className="flex flex-col items-center justify-center py-10 gap-3 opacity-30">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="text-[9px] font-black uppercase tracking-widest">Consultando...</span>
          </div>
        )}

        {groupedSales.map(group => (
          <div key={group.dateLabel} className="space-y-3">
            <div className="flex justify-between items-center px-6 py-2 text-white rounded-xl shadow-md" style={{ backgroundColor: brandColor }}>
              <span className="text-[10px] font-black uppercase tracking-widest">{group.dateLabel}</span>
              <span className="font-headline font-black text-lg">S/ {group.dayTotal.toFixed(2)}</span>
            </div>
            
            <div className="space-y-2">
              {group.sales.map(s => (
                <Card key={s.id} className={cn(
                  "rounded-2xl border border-primary/5 overflow-hidden transition-all",
                  s.status === 'annulled' ? "opacity-30 bg-secondary/30" : "bg-white shadow-sm hover:shadow-md"
                )}>
                  <CardContent className="p-3 md:p-4 flex items-center justify-between">
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between items-center pr-4">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-[11px] text-foreground uppercase tracking-wide">{s.id}</span>
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-[8px] font-black h-5 px-3 uppercase border-none rounded-lg", 
                              s.status === 'active' ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                            )}
                          >
                            {s.status === 'active' ? 'VENTA' : 'ANULADO'}
                          </Badge>
                        </div>
                        <span className="font-headline font-black text-[13px] text-foreground">S/ {Number(s.total).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center pr-4">
                        <span className="text-[11px] font-black text-foreground uppercase truncate max-w-[150px]">
                          {s.customerName}
                        </span>
                        <span className="text-[9px] font-medium text-muted-foreground uppercase bg-secondary px-2 py-0.5 rounded-md">
                          {s.items?.reduce((acc: number, item: any) => acc + (Number(item.quantity) || 0), 0)} UND
                        </span>
                      </div>
                    </div>

                    <div className="relative">
                      {confirmAnnulId === s.id ? (
                        <div className="flex gap-1">
                          <Button size="icon" className="h-9 w-9 bg-destructive text-white rounded-xl" onClick={() => annulQuote(s)}><Check className="w-5 h-5" /></Button>
                          <Button size="icon" className="h-9 w-9 bg-secondary text-primary rounded-xl" onClick={() => setConfirmAnnulId(null)}><X className="w-5 h-5" /></Button>
                        </div>
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-primary/5">
                              <MoreVertical className="w-5 h-5 text-primary" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl p-2 w-48 shadow-xl">
                            <DropdownMenuItem className="text-[11px] font-black uppercase gap-3 p-3 rounded-lg" onClick={() => router.push(`/quotes?edit=${s.id}`)}>
                              <Edit2 className="w-3.5 h-3.5" style={{ color: brandColor }} /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-[11px] font-black uppercase gap-3 p-3 rounded-lg" onClick={() => handleSendImage(s)}>
                              <ImageIcon className="w-3.5 h-3.5" style={{ color: brandColor }} /> Enviar Foto
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-[11px] font-black uppercase gap-3 p-3 rounded-lg text-destructive" onClick={() => setConfirmAnnulId(s.id)}>
                              <Ban className="w-3.5 h-3.5" /> Anular
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

        {!loading && !showHistorical && (
          <div className="flex justify-center pt-6 pb-10">
            <Button 
              variant="outline" 
              className="h-10 rounded-xl border-primary/20 text-primary font-black uppercase text-[9px] tracking-widest px-8"
              onClick={() => setShowHistorical(true)}
            >
              <History className="w-3.5 h-3.5 mr-2" /> Cargar Historial Antiguo
            </Button>
          </div>
        )}
      </div>

      <div className="fixed -left-[4000px] top-0">
        {activeReceipt && (
          <div ref={receiptRef} style={{ width: '560px', backgroundColor: '#ffffff', padding: '30px', fontFamily: 'Arial, sans-serif' }}>
            <div style={{ backgroundColor: brandColor, color: 'white', textAlign: 'center', padding: '30px', borderRadius: '20px' }}>
              <div style={{ fontSize: '32px', fontWeight: 950, marginBottom: '5px' }}>{companySettings?.companyName || "BOUTIQUE"}</div>
              <div style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '2px' }}>BOLETA DE VENTA · {activeReceipt.id}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
