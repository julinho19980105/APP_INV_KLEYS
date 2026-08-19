
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  Calendar,
  MoreVertical,
  CheckCircle2
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

export default function SalesPage() {
  const db = useFirestore()
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = React.useState("")

  const quotesRef = React.useMemo(() => db ? query(collection(db, "quotes"), orderBy("createdAt", "desc")) : null, [db])
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
      
      // Reintegrar stock solo para productos registrados
      for (const item of quote.items) {
        if (item.isRegistered) {
          const qty = Number(item.quantity)
          await updateDoc(doc(db, "products", item.productId), {
            stock: increment(qty)
          })
          await addDoc(collection(db, "movements"), {
            productCode: item.productId,
            type: "return",
            quantity: qty,
            reason: `ANULACIÓN SERIE ${quote.id}`,
            timestamp: serverTimestamp()
          })
        }
      }
      
      toast({ title: "SERIE ANULADA", description: `EL STOCK REGISTRADO HA SIDO REINTEGRADO.` })
    } catch (e) {
      toast({ variant: "destructive", title: "ERROR", description: "NO SE PUDO ANULAR LA SERIE." })
    }
  }

  return (
    <div className="space-y-6 pt-2 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-3xl font-headline font-black text-black uppercase tracking-tight">Historial de Ventas</h1>
          <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] ml-1 mt-1">Gestión de Boletas e Ingresos Diva</p>
        </div>
        <div className="flex w-full md:w-auto gap-3">
           <div className="relative flex-1 md:w-80">
            <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-black/40" />
            <Input 
              placeholder="BUSCAR SERIE O CLIENTE..." 
              className="pl-10 h-11 rounded-2xl border-black/10 font-black text-xs uppercase"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="rounded-[2rem] border-none bg-black text-white shadow-xl">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div className="text-[9px] font-black uppercase text-white/40 tracking-widest">Ingresos Totales</div>
              <TrendingUp className="w-4 h-4 text-primary" />
            </div>
            <div className="mt-4 font-headline font-black text-4xl tracking-tighter">S/ {totalRevenue.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card className="rounded-[2rem] border shadow-sm bg-white">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div className="text-[9px] font-black uppercase text-black/40 tracking-widest">Boletas Activas</div>
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            </div>
            <div className="mt-4 font-headline font-black text-4xl tracking-tighter">{activeSalesCount}</div>
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
              <TableRow key={s.id} className="hover:bg-black/5 transition-colors group">
                <TableCell className="font-black text-xs text-black pl-8">{s.id}</TableCell>
                <TableCell className="text-[10px] font-black text-black/60 uppercase">
                  {s.createdAt?.toDate ? s.createdAt.toDate().toLocaleDateString() : '---'}
                </TableCell>
                <TableCell className="font-black text-[10px] text-black uppercase">{s.customerName}</TableCell>
                <TableCell className="text-center font-black text-xs text-black">{s.items?.length || 0}</TableCell>
                <TableCell className="font-black text-sm text-black">S/ {s.total?.toFixed(2)}</TableCell>
                <TableCell>
                  <Badge 
                    variant={s.status === 'active' ? 'default' : 'destructive'} 
                    className={cn(
                      "text-[8px] font-black uppercase tracking-widest px-2 py-0",
                      s.status === 'active' ? "bg-green-100 text-green-700 border-green-200" : ""
                    )}
                  >
                    {s.status === 'active' ? 'VIGENTE' : 'ANULADA'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right pr-8">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-black/10 transition-colors">
                        <MoreVertical className="w-4 h-4 text-black" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-2xl border-black/10 shadow-2xl p-2">
                      <DropdownMenuItem className="text-[10px] font-black uppercase gap-2 cursor-pointer p-3 rounded-xl">
                        <Eye className="w-3.5 h-3.5" /> Ver Detalle
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-[10px] font-black uppercase gap-2 cursor-pointer p-3 rounded-xl">
                        <Printer className="w-3.5 h-3.5" /> Reimprimir
                      </DropdownMenuItem>
                      {s.status === 'active' && (
                        <DropdownMenuItem 
                          className="text-[10px] font-black uppercase gap-2 cursor-pointer p-3 rounded-xl text-destructive hover:bg-destructive/10"
                          onClick={() => annulQuote(s)}
                        >
                          <Ban className="w-3.5 h-3.5" /> Anular Venta
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
            {!loading && filteredQuotes.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-20">
                  <div className="flex flex-col items-center gap-2 opacity-20">
                    <FileText className="w-10 h-10" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Sin registros encontrados</span>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
