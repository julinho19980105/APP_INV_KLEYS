
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
  Eye, 
  TrendingUp, 
  MoreVertical,
  CheckCircle2,
  Check,
  X
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

  const quotesRef = React.useMemo(() => db ? query(collection(db, "quotes"), orderBy("id", "desc")) : null, [db])
  const { data: quotes = [], loading } = useCollection(quotesRef)

  const filteredQuotes = React.useMemo(() => {
    const q = searchQuery.toLowerCase()
    return quotes.filter(s => 
      s.id.toLowerCase().includes(q) || 
      s.customerName?.toLowerCase().includes(q)
    )
  }, [quotes, searchQuery])

  const totalRevenue = quotes.reduce((acc, s) => s.status === 'active' ? acc + (s.total || 0) : acc, 0)
  const activeSalesCount = quotes.filter(s => s.status === 'active').length

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
            reason: `ANULACIÓN BOLETA ${quote.id}`,
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
    <div className="space-y-6 pt-2 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-3xl font-headline font-black text-black uppercase tracking-tight">Ventas</h1>
          <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] ml-1 mt-1">Historial Industrial Diva</p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-black/40" />
          <Input 
            placeholder="BUSCAR BOLETA O CLIENTE..." 
            className="pl-10 h-11 rounded-2xl border-black/10 font-black text-xs uppercase"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="rounded-[2rem] border shadow-sm bg-black text-white">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <div className="text-[9px] font-black uppercase text-white/40 tracking-widest">INGRESOS TOTALES</div>
              <div className="mt-2 font-headline font-black text-4xl tracking-tighter">S/ {totalRevenue.toFixed(2)}</div>
            </div>
            <TrendingUp className="w-8 h-8 text-primary" />
          </CardContent>
        </Card>
        <Card className="rounded-[2rem] border shadow-sm bg-white">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <div className="text-[9px] font-black uppercase text-black/40 tracking-widest">BOLETAS ACTIVAS</div>
              <div className="mt-2 font-headline font-black text-4xl tracking-tighter">{activeSalesCount}</div>
            </div>
            <CheckCircle2 className="w-8 h-8 text-green-500" />
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[2.5rem] border shadow-sm overflow-hidden bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-black/5 hover:bg-black/5 border-none">
              <TableHead className="font-black text-[9px] uppercase text-black pl-8">Serie</TableHead>
              <TableHead className="font-black text-[9px] uppercase text-black">Fecha</TableHead>
              <TableHead className="font-black text-[9px] uppercase text-black">Cliente</TableHead>
              <TableHead className="font-black text-[9px] uppercase text-black text-center">Items</TableHead>
              <TableHead className="font-black text-[9px] uppercase text-black">Total S/</TableHead>
              <TableHead className="font-black text-[9px] uppercase text-black">Estado</TableHead>
              <TableHead className="text-right pr-8"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredQuotes.map(s => (
              <TableRow key={s.id} className="hover:bg-black/5 transition-colors border-b last:border-0">
                <TableCell className="font-black text-xs text-black pl-8">{s.id}</TableCell>
                <TableCell className="text-[10px] font-black text-black/60 uppercase">
                  {s.createdAt?.toDate ? s.createdAt.toDate().toLocaleDateString() : '---'}
                </TableCell>
                <TableCell className="font-black text-[10px] text-black uppercase truncate max-w-[200px]">{s.customerName}</TableCell>
                <TableCell className="text-center font-black text-xs text-black">{s.items?.length || 0}</TableCell>
                <TableCell className="font-black text-sm text-black">S/ {s.total?.toFixed(2)}</TableCell>
                <TableCell>
                  <Badge variant={s.status === 'active' ? 'default' : 'destructive'} className={cn("text-[8px] font-black uppercase px-2", s.status === 'active' ? "bg-green-100 text-green-700 border-green-200" : "")}>
                    {s.status === 'active' ? 'ACTIVA' : 'ANULADA'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right pr-8">
                  {confirmAnnulId === s.id ? (
                    <div className="flex justify-end gap-1">
                      <Button size="icon" className="h-8 w-8 bg-destructive text-white rounded-lg" onClick={() => annulQuote(s)}><Check className="w-4 h-4" /></Button>
                      <Button size="icon" className="h-8 w-8 bg-black/5 text-black rounded-lg" onClick={() => setConfirmAnnulId(null)}><X className="w-4 h-4" /></Button>
                    </div>
                  ) : (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-black/10"><MoreVertical className="w-4 h-4 text-black" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-2xl border-black/10 shadow-2xl p-2">
                        <DropdownMenuItem className="text-[10px] font-black uppercase gap-2 cursor-pointer p-3 rounded-xl"><Eye className="w-3.5 h-3.5" /> Detalle</DropdownMenuItem>
                        <DropdownMenuItem className="text-[10px] font-black uppercase gap-2 cursor-pointer p-3 rounded-xl"><Printer className="w-3.5 h-3.5" /> Imprimir</DropdownMenuItem>
                        {s.status === 'active' && (
                          <DropdownMenuItem className="text-[10px] font-black uppercase gap-2 cursor-pointer p-3 rounded-xl text-destructive" onClick={() => setConfirmAnnulId(s.id)}><Ban className="w-3.5 h-3.5" /> Anular Venta</DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!loading && filteredQuotes.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-20 opacity-20"><FileText className="w-10 h-10 mx-auto" /><span className="text-[10px] font-black uppercase">Sin registros</span></TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
