
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
  Calendar
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

  const sanitize = (text: string) => {
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ñ/g, "n").replace(/Ñ/g, "N")
  }

  const handlePrintBLE = async (sale: any) => {
    if (!bleDevice || !bleCharacteristic) {
      try {
        const device = await (navigator as any).bluetooth.requestDevice({
          filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb', '0000ff00-0000-1000-8000-00805f9b34fb'] }]
        })
        const server = await device.gatt.connect()
        const service = await server.getPrimaryService('0000ff00-0000-1000-8000-00805f9b34fb')
        const char = await service.getCharacteristic('0000ff01-0000-1000-8000-00805f9b34fb')
        setBleDevice(device)
        setBleCharacteristic(char)
        toast({ title: "IMPRESORA CONECTADA" })
      } catch (e) { toast({ variant: "destructive", title: "ERROR DE CONEXIÓN" }) }
      return
    }
    // ... lógica de impresión simplificada aquí ...
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
    <div className="space-y-6 pt-2 pb-20 max-w-4xl mx-auto px-2 md:px-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b-4 border-black pb-6">
        <div>
          <h1 className="text-[10px] font-black text-black uppercase tracking-[0.3em]">Total Ventas del Mes</h1>
          <div className="font-headline font-black text-5xl md:text-6xl text-black tracking-tighter mt-1">
            S/ {currentMonthTotal.toFixed(2)}
          </div>
        </div>
        <div className="flex w-full md:w-auto gap-2">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3.5 top-3.5 h-4 w-4" style={{ color: brandColor }} />
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
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between items-center pr-8 md:pr-16">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-base text-black">{s.id}</span>
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-[8px] font-black h-5 px-3 uppercase border-none rounded-lg", 
                              s.status === 'active' && "bg-green-50 text-green-600",
                              s.status === 'shipped' && "bg-blue-50 text-blue-600",
                              s.status === 'annulled' && "bg-red-50 text-red-600"
                            )}
                          >
                            {s.status === 'active' ? 'ACTIVO' : s.status === 'shipped' ? 'ENVIADO' : 'ANULADO'}
                          </Badge>
                        </div>
                        <span className="font-headline font-black text-xl text-black">S/ {Number(s.total).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center pr-8 md:pr-16">
                        <span className="text-[10px] font-black text-black uppercase truncate max-w-[150px] md:max-w-none">
                          {s.customerName}
                        </span>
                        <span className="text-[9px] font-normal text-black/40 uppercase">
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
                              <Edit2 className="w-4 h-4" style={{ color: brandColor }} /> Editar Venta
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-[11px] font-black uppercase gap-3 p-4 rounded-xl cursor-pointer" onClick={() => handlePrintBLE(s)}>
                              {bleDevice ? <Printer className="w-4 h-4" style={{ color: brandColor }} /> : <Bluetooth className="w-4 h-4" style={{ color: brandColor }} />} 
                              {bleDevice ? 'Imprimir Ticket' : 'Conectar Impresora'}
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-[11px] font-black uppercase gap-3 p-4 rounded-xl cursor-pointer" onClick={() => handleSendImage(s)}>
                              <ImageIcon className="w-4 h-4" style={{ color: brandColor }} /> Enviar Imagen
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-[11px] font-black uppercase gap-3 p-4 rounded-xl cursor-pointer" onClick={() => {
                              const summary = `Venta ${s.id}\nCliente: ${s.customerName}\nTotal: S/ ${Number(s.total).toFixed(2)}`;
                              navigator.clipboard.writeText(summary);
                              toast({ title: "RESUMEN COPIADO" });
                            }}>
                              <FileText className="w-4 h-4" style={{ color: brandColor }} /> Enviar Texto
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

      <div className="fixed -left-[4000px] top-0">
        {activeReceipt && (
          <div ref={receiptRef} className="boleta" style={{ width: '560px', backgroundColor: '#F4F5F7', padding: '25px 12px', fontFamily: 'Arial, sans-serif' }}>
            {/* Plantilla de boleta dinámica usando activeReceipt y brandColor */}
            <div style={{ backgroundColor: brandColor, color: 'white', textAlign: 'center', padding: '22px' }}>
              <div style={{ fontSize: '24px', fontWeight: 900 }}>{companySettings?.companyName || "DIVA"}</div>
              <div style={{ fontSize: '12px', fontWeight: 700 }}>BOLETA INTERNA · {activeReceipt.id}</div>
            </div>
            {/* ... resto del contenido de la boleta ... */}
          </div>
        )}
      </div>
    </div>
  )
}
