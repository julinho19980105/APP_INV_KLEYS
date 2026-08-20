
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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Search, Edit2, X, Trash2, MoreVertical, Check, PackageSearch, Clock, Calendar } from "lucide-react"
import { cn } from "@/lib/utils"
import { useCollection, useFirestore } from "@/firebase"
import { collection, query, orderBy, doc, deleteDoc, getDocs,尊ere, writeBatch } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"

export default function InventoryPage() {
  const router = useRouter()
  const db = useFirestore()
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = React.useState("")
  const [viewType, setViewType] = React.useState<"collection" | "category">("collection")

  const productsRef = React.useMemo(() => db ? query(collection(db, "products"), orderBy("code", "asc")) : null, [db])
  const movementsRef = React.useMemo(() => db ? query(collection(db, "movements"), orderBy("timestamp", "desc")) : null, [db])
  const { data: products = [] } = useCollection(productsRef)
  const { data: movements = [] } = useCollection(movementsRef)

  const filteredProducts = React.useMemo(() => {
    const q = searchQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    return products.filter(p => 
      p.name?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q) || 
      p.code?.toLowerCase().includes(q)
    )
  }, [products, searchQuery])

  // Agrupación de Kardex por Fecha
  const groupedMovements = React.useMemo(() => {
    const groups: Record<string, any[]> = {}
    movements.forEach(m => {
      const date = m.timestamp?.toDate ? m.timestamp.toDate() : new Date()
      const dayLabel = date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()
      if (!groups[dayLabel]) groups[dayLabel] = []
      groups[dayLabel].push(m)
    })
    return Object.entries(groups)
  }, [movements])

  const onEdit = (id: string) => router.push(`/registry?edit=${id}`)
  
  const onDelete = async (prod: {id: string, code: string}) => {
    if (!db) return
    try {
      await deleteDoc(doc(db, "products", prod.id))
      const mRef = collection(db, "movements")
      const q = query(mRef, where("productCode", "==", prod.code))
      const snap = await getDocs(q)
      const batch = writeBatch(db)
      snap.forEach(d => batch.delete(d.ref))
      await batch.commit()
      toast({ title: "BAJA PROCESADA" })
    } catch (e) {
      toast({ variant: "destructive", title: "ERROR AL ELIMINAR" })
    }
  }

  return (
    <div className="space-y-6 pt-2 pb-20 max-w-6xl mx-auto px-2 md:px-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-3xl font-headline font-black text-black uppercase tracking-tight">Inventario Diva</h1>
          <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] ml-1 mt-1">Control de Stock y Kardex Industrial</p>
        </div>
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-4 h-4 w-4 text-black/40" />
          <Input 
            placeholder="BUSCAR DNI O NOMBRE..." 
            className="pl-12 h-12 rounded-2xl border-black/10 font-black text-xs uppercase shadow-sm"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="bg-black/5 p-1 rounded-2xl w-full justify-start border mb-6">
          <TabsTrigger value="all" className="rounded-xl px-10 data-[state=active]:bg-black data-[state=active]:text-white text-[10px] font-black uppercase">Stock Maestro</TabsTrigger>
          <TabsTrigger value="movements" className="rounded-xl px-10 data-[state=active]:bg-black data-[state=active]:text-white text-[10px] font-black uppercase">Kardex Diario</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all">
          <div className="border rounded-[2rem] bg-white shadow-sm overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-black/5 hover:bg-black/5 border-none">
                  <TableHead className="font-black uppercase text-[9px] text-black pl-8">Prenda / DNI</TableHead>
                  <TableHead className="font-black uppercase text-[9px] text-black">Precios (F/M/U)</TableHead>
                  <TableHead className="font-black uppercase text-[9px] text-black text-center">Stock</TableHead>
                  <TableHead className="text-right pr-8"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map(p => (
                  <TableRow key={p.id} className="hover:bg-black/5 transition-colors border-b last:border-0">
                    <TableCell className="pl-8 py-4">
                      <div className="flex flex-col">
                        <span className="font-black text-xs text-black uppercase truncate max-w-[200px]">{p.name}</span>
                        <span className="font-black text-[9px] text-black/40 uppercase">{p.code} | {p.collection}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col text-[10px] font-black uppercase">
                        <span className="text-black/60">F: S/{p.priceFardo} · M: S/{p.priceMayor}</span>
                        <span className="text-primary">U: S/{p.priceUnidad}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className={cn(
                        "font-black text-[11px] px-2 py-0.5 rounded-lg inline-block",
                        p.stock <= 0 ? "bg-destructive/10 text-destructive" : 
                        p.stock < 10 ? "bg-orange-50 text-orange-600" : 
                        "bg-green-50 text-green-600"
                      )}>
                        {p.stock} <span className="text-[8px]">UND</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right pr-8">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl"><MoreVertical className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-2xl p-2 shadow-2xl">
                          <DropdownMenuItem className="text-[10px] font-black uppercase gap-2 cursor-pointer p-3 rounded-xl" onClick={() => onEdit(p.id)}><Edit2 className="w-3.5 h-3.5" /> Editar</DropdownMenuItem>
                          <DropdownMenuItem className="text-[10px] font-black uppercase gap-2 cursor-pointer p-3 rounded-xl text-destructive hover:bg-destructive/10" onClick={() => onDelete({id: p.id, code: p.code})}><Trash2 className="w-3.5 h-3.5" /> Eliminar</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="movements" className="space-y-6">
          {groupedMovements.map(([date, items]) => (
            <div key={date} className="space-y-3">
              <div className="flex items-center gap-3 px-6 py-2 bg-black text-white rounded-xl shadow-md">
                <Calendar className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">{date}</span>
              </div>
              <div className="border rounded-[2rem] bg-white shadow-sm overflow-hidden">
                <Table>
                  <TableBody>
                    {items.map(m => (
                      <TableRow key={m.id} className="hover:bg-black/5 transition-colors border-b last:border-0">
                        <TableCell className="pl-8 py-3">
                          <div className="flex justify-between items-start">
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-2">
                                {m.type === 'in' || m.type === 'return' ? (
                                  <span className="text-[8px] font-black uppercase bg-green-100 text-green-700 px-1.5 rounded">Entrada</span>
                                ) : (
                                  <span className="text-[8px] font-black uppercase bg-red-100 text-red-700 px-1.5 rounded">Salida</span>
                                )}
                                <span className="font-black text-[11px] text-black">{m.quantity} UND.</span>
                              </div>
                              <span className="text-[9px] font-black text-black/40 uppercase">{m.reason} · DNI: {m.productCode}</span>
                            </div>
                            <span className="text-[8px] font-black text-black/20 pr-4">
                              {m.timestamp?.toDate ? m.timestamp.toDate().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : "--:--"}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ))}
          {movements.length === 0 && (
            <div className="py-24 text-center text-[10px] font-black uppercase text-black/20 tracking-widest">Sin movimientos registrados</div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
