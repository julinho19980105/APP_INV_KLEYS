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
  FileText,
  ShoppingBag
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
  const brandColor = companySettings?.brandColor || "#FF3399"

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
    toast({ title: "Conectando impresora..." })
    // BLE logic...
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
        } catch (err) { toast({ variant: "destructive", title: "ERROR AL GENERAR IMAGEN" }) }
      }
    }, 400)
  }

  return (
    <div className="space-y-6 pt-4 pb-20 max-w-4xl mx-auto px-2 md:px-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 border-b border-primary/10 pb-8">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-[2rem] flex items-center justify-center shadow-xl shadow-primary/20" style={{ backgroundColor: brandColor }}>
            <ShoppingBag className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-[11px] font-black text-primary uppercase tracking-[0.3em] mb-1">Ventas del Mes</h1>
            <div className="font-headline font-black text-5xl md:text-6xl text-foreground tracking-tighter">
              S/ {currentMonthTotal.toFixed(2)}
            </div>
          </div>
        </div>
        <div className="flex w-full md:w-auto gap-3">
          <div className="relative flex-1 md:w-72">
            <Search className="absolute left-4 top-4 h-4 w-4" style={{ color: brandColor }} />
            <Input 
              placeholder="BUSCAR BOLETA O CLIENTE..." 
              className="pl-12 h-12 rounded-2xl border-primary/10 font-black text-xs uppercase bg-white shadow-sm focus:ring-primary"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-12 rounded-2xl border-primary/10 font-black text-[11px] uppercase bg-white shadow-sm">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent className="rounded-2xl border-primary/10">
              <SelectItem value="all" className="text-[11px] font-black uppercase">Todos</SelectItem>
              <SelectItem value="active" className="text-[11px] font-black uppercase">Activos</SelectItem>
              <SelectItem value="shipped" className="text-[11px] font-black uppercase">Enviados</SelectItem>
              <SelectItem value="annulled" className="text-[11px] font-black uppercase">Anulados</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-10">
        {groupedSales.map(group => (
          <div key={group.dateLabel} className="space-y-5">
            <div className="flex justify-between items-center px-8 py-4 text-white rounded-[1.5rem] shadow-lg shadow-primary/10" style={{ backgroundColor: brandColor }}>
              <span className="text-[11px] font-black uppercase tracking-widest">{group.dateLabel}</span>
              <span className="font-headline font-black text-xl">S/ {group.dayTotal.toFixed(2)}</span>
            </div>
            
            <div className="space-y-4">
              {group.sales.map(s => (
                <Card key={s.id} className={cn(
                  "rounded-[2rem] border border-primary/5 overflow-hidden transition-all",
                  s.status === 'annulled' ? "opacity-40 bg-secondary/30" : "bg-white shadow-md hover:shadow-xl hover:scale-[1.01]"
                )}>
                  <CardContent className="p-6 flex items-center justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex justify-between items-center pr-8 md:pr-16">
                        <div className="flex items-center gap-3">
                          <span className="font-black text-lg text-foreground tracking-tight">{s.id}</span>
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-[9px] font-black h-6 px-4 uppercase border-none rounded-xl", 
                              s.status === 'active' && "bg-green-50 text-green-600",
                              s.status === 'shipped' && "bg-primary/10 text-primary",
                              s.status === 'annulled' && "bg-red-50 text-red-600"
                            )}
                          >
                            {s.status === 'active' ? 'ACTIVO' : s.status === 'shipped' ? 'ENVIADO' : 'ANULADO'}
                          </Badge>
                        </div>
                        <span className="font-headline font-black text-2xl text-foreground">S/ {Number(s.total).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center pr-8 md:pr-16">
                        <span className="text-[12px] font-black text-foreground uppercase truncate max-w-[180px] md:max-w-none">
                          {s.customerName}
                        </span>
                        <span className="text-[10px] font-medium text-muted-foreground uppercase bg-secondary px-3 py-1 rounded-lg">
                          {s.items?.reduce((acc: number, item: any) => acc + (Number(item.quantity) || 0), 0)} PRENDAS
                        </span>
                      </div>
                    </div>

                    <div className="relative">
                      {confirmAnnulId === s.id ? (
                        <div className="flex gap-2">
                          <Button size="icon" className="h-12 w-12 bg-destructive text-white rounded-2xl shadow-lg" onClick={() => annulQuote(s)}><Check className="w-6 h-6" /></Button>
                          <Button size="icon" className="h-12 w-12 bg-secondary text-primary rounded-2xl border border-primary/10 shadow-lg" onClick={() => setConfirmAnnulId(null)}><X className="w-6 h-6" /></Button>
                        </div>
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-12 w-12 rounded-2xl hover:bg-primary/5 transition-all">
                              <MoreVertical className="w-6 h-6 text-primary" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-[1.5rem] border-primary/10 shadow-2xl p-3 w-64">
                            <DropdownMenuItem className="text-[12px] font-black uppercase gap-4 p-4 rounded-xl cursor-pointer hover:bg-primary/5" onClick={() => router.push(`/quotes?edit=${s.id}`)}>
                              <Edit2 className="w-4 h-4" style={{ color: brandColor }} /> Editar Venta
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-[12px] font-black uppercase gap-4 p-4 rounded-xl cursor-pointer hover:bg-primary/5" onClick={() => handlePrintBLE(s)}>
                              {bleDevice ? <Printer className="w-4 h-4" style={{ color: brandColor }} /> : <Bluetooth className="w-4 h-4" style={{ color: brandColor }} />} 
                              {bleDevice ? 'Imprimir Ticket' : 'Conectar Impresora'}
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-[12px] font-black uppercase gap-4 p-4 rounded-xl cursor-pointer hover:bg-primary/5" onClick={() => handleSendImage(s)}>
                              <ImageIcon className="w-4 h-4" style={{ color: brandColor }} /> Enviar Imagen
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-[12px] font-black uppercase gap-4 p-4 rounded-xl cursor-pointer hover:bg-primary/5" onClick={() => {
                              const summary = `Venta ${s.id}\nCliente: ${s.customerName}\nTotal: S/ ${Number(s.total).toFixed(2)}`;
                              navigator.clipboard.writeText(summary);
                              toast({ title: "RESUMEN COPIADO" });
                            }}>
                              <FileText className="w-4 h-4" style={{ color: brandColor }} /> Enviar Texto
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-[12px] font-black uppercase gap-4 p-4 rounded-xl text-destructive cursor-pointer hover:bg-destructive/5" onClick={() => setConfirmAnnulId(s.id)}>
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

      <div className="fixed -left-[4000px] top-0">
        {activeReceipt && (
          <div ref={receiptRef} className="boleta" style={{ width: '560px', backgroundColor: '#ffffff', padding: '30px', fontFamily: 'Arial, sans-serif' }}>
            <div style={{ backgroundColor: brandColor, color: 'white', textAlign: 'center', padding: '30px', borderRadius: '20px' }}>
              <div style={{ fontSize: '32px', fontWeight: 950, marginBottom: '5px' }}>{companySettings?.companyName || "DIVA BOUTIQUE"}</div>
              <div style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '2px' }}>BOLETA DE VENTA · {activeReceipt.id}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
