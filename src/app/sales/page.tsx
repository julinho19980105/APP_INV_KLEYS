
"use client"

import * as React from "react"
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
  Share2
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

export default function SalesPage() {
  const db = useFirestore()
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = React.useState("")
  const [confirmAnnulId, setConfirmAnnulId] = React.useState<string | null>(null)

  const quotesRef = React.useMemo(() => db ? query(collection(db, "quotes"), orderBy("createdAt", "desc")) : null, [db])
  const { data: quotes = [], loading } = useCollection(quotesRef)

  const filteredQuotes = React.useMemo(() => {
    const q = searchQuery.toLowerCase()
    return quotes.filter(s => 
      s.id.toLowerCase().includes(q) || 
      s.customerName?.toLowerCase().includes(q)
    )
  }, [quotes, searchQuery])

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
      if (sale.status === 'active') {
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
      toast({ title: "BOLETA ANULADA", description: `STOCK REINTEGRADO.` })
      setConfirmAnnulId(null)
    } catch (e) {
      toast({ variant: "destructive", title: "ERROR AL ANULAR" })
    }
  }

  return (
    <div className="space-y-6 pt-2 pb-20 max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b-2 border-black pb-4">
        <div>
          <h1 className="text-3xl font-headline font-black text-black uppercase tracking-tight">Ventas e Historial</h1>
          <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] ml-1 mt-1">Kardex de Salidas Diva Industrial</p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-black/40" />
          <Input 
            placeholder="BUSCAR BOLETA O CLIENTE..." 
            className="pl-10 h-11 rounded-xl border-black/10 font-black text-xs uppercase bg-white shadow-sm"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
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
                          {s.status === 'annulled' && (
                            <Badge variant="destructive" className="text-[7px] font-black h-4 px-1">ANULADA</Badge>
                          )}
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
                            <DropdownMenuItem className="text-[10px] font-black uppercase gap-3 p-3 rounded-xl cursor-pointer">
                              <Edit2 className="w-4 h-4" /> Editar Venta
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-[10px] font-black uppercase gap-3 p-3 rounded-xl cursor-pointer">
                              <Printer className="w-4 h-4" /> Imprimir BLE
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-[10px] font-black uppercase gap-3 p-3 rounded-xl cursor-pointer">
                              <ImageIcon className="w-4 h-4" /> Enviar Imagen
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-[10px] font-black uppercase gap-3 p-3 rounded-xl cursor-pointer">
                              <MessageSquare className="w-4 h-4" /> Enviar Texto
                            </DropdownMenuItem>
                            {s.status === 'active' && (
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

        {!loading && groupedSales.length === 0 && (
          <div className="py-32 text-center opacity-10">
            <FileText className="w-16 h-16 mx-auto mb-4" />
            <span className="text-xs font-black uppercase tracking-widest">Sin ventas registradas en el historial</span>
          </div>
        )}
      </div>
    </div>
  )
}
