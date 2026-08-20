
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
import { Search, Edit2, Trash2, MoreVertical, Calendar, Package, Layers, LayoutGrid } from "lucide-react"
import { cn } from "@/lib/utils"
import { useCollection, useFirestore, useDoc } from "@/firebase"
import { collection, query, orderBy, doc, deleteDoc, getDocs, where, writeBatch } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"

export default function InventoryPage() {
  const router = useRouter()
  const db = useFirestore()
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = React.useState("")

  const configDocRef = React.useMemo(() => db ? doc(db, "config", "global") : null, [db])
  const { data: config } = useDoc(configDocRef)
  const brandColor = config?.brandColor || "#FF3399"
  
  const productsRef = React.useMemo(() => db ? query(collection(db, "products"), orderBy("code", "asc")) : null, [db])
  const movementsRef = React.useMemo(() => db ? query(collection(db, "movements"), orderBy("timestamp", "desc")) : null, [db])
  const { data: products = [] } = useCollection(productsRef)
  const { data: movements = [] } = useCollection(movementsRef)

  const viewType = config?.inventoryViewMode || "collection"

  const filteredProducts = React.useMemo(() => {
    const q = searchQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    return products.filter(p => 
      p.name?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q) || 
      p.code?.toLowerCase().includes(q)
    )
  }, [products, searchQuery])

  const groupedProducts = React.useMemo(() => {
    const groups: Record<string, any[]> = {}
    filteredProducts.forEach(p => {
      const key = (p[viewType] || "SIN CLASIFICAR").toUpperCase()
      if (!groups[key]) groups[key] = []
      groups[key].push(p)
    });
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]))
  }, [filteredProducts, viewType])

  const groupedMovements = React.useMemo(() => {
    const groups: Record<string, any[]> = {}
    movements.forEach(m => {
      const date = m.timestamp?.toDate ? m.timestamp.toDate() : new Date()
      const dayLabel = date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()
      if (!groups[dayLabel]) groups[dayLabel] = { label: dayLabel, items: [] }
      groups[dayLabel].items.push(m)
    })
    return Object.values(groups)
  }, [movements])

  const onEdit = (id: string) => router.push(`/registry?edit=${id}`)
  
  const onDelete = async (prod: {id: string, code: string}) => {
    if (!db) return
    try {
      await deleteDoc(doc(db, "products", prod.id))
      toast({ title: "BAJA PROCESADA" })
    } catch (e) { toast({ variant: "destructive", title: "ERROR AL ELIMINAR" }) }
  }

  return (
    <div className="space-y-6 pt-2 pb-20 max-w-full px-2 md:px-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-headline font-black text-black uppercase tracking-tight">Almacén Diva</h1>
          <p className="text-[9px] font-black text-primary uppercase tracking-[0.2em] ml-1 mt-0.5">
            Vista por {viewType === 'collection' ? 'Colección' : 'Categoría'} · Industrial
          </p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-3.5 h-3.5 w-3.5" style={{ color: brandColor }} />
          <Input 
            placeholder="BUSCAR DNI O PRENDA..." 
            className="pl-10 h-10 rounded-xl border-black/10 font-black text-xs uppercase shadow-sm bg-white"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="bg-black/5 p-1 rounded-2xl w-full md:w-auto justify-start border mb-4">
          <TabsTrigger value="all" className="rounded-xl px-8 data-[state=active]:bg-black data-[state=active]:text-white text-[9px] font-black uppercase">Stock Maestro</TabsTrigger>
          <TabsTrigger value="movements" className="rounded-xl px-8 data-[state=active]:bg-black data-[state=active]:text-white text-[9px] font-black uppercase">Kardex Diario</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="space-y-6">
          {groupedProducts.map(([groupName, items]) => (
            <div key={groupName} className="space-y-2">
              <div className="flex items-center gap-2 px-4 py-1.5 bg-black/5 border rounded-xl w-fit">
                {viewType === 'collection' ? 
                  <LayoutGrid className="w-3.5 h-3.5" style={{ color: brandColor }} /> : 
                  <Layers className="w-3.5 h-3.5" style={{ color: brandColor }} />
                }
                <span className="text-[10px] font-black uppercase tracking-widest">{groupName}</span>
              </div>
              
              <div className="border rounded-2xl bg-white shadow-sm overflow-x-auto scrollbar-hide">
                <Table className="min-w-[700px]">
                  <TableHeader>
                    <TableRow className="bg-black/5 hover:bg-black/5 border-none h-10">
                      <TableHead className="font-black uppercase text-[8px] text-black pl-6">Prenda / DNI</TableHead>
                      <TableHead className="font-black uppercase text-[8px] text-black">Precios (F / M / U)</TableHead>
                      <TableHead className="font-black uppercase text-[8px] text-black text-center">Stock Disponible</TableHead>
                      <TableHead className="w-12 pr-6"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map(p => (
                      <TableRow key={p.id} className="hover:bg-black/5 transition-colors border-b last:border-0 h-14">
                        <TableCell className="pl-6 py-2">
                          <div className="flex flex-col">
                            <span className="font-black text-[11px] text-black uppercase truncate max-w-[200px] leading-tight">{p.name}</span>
                            <span className="font-normal text-[8px] text-black/40 uppercase leading-tight">{p.code}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-2">
                          <div className="flex flex-col text-[9px] uppercase">
                            <span className="font-normal text-black/60 leading-tight">F: S/{p.priceFardo} · M: S/{p.priceMayor}</span>
                            <span className="font-black text-black leading-tight">U: S/{p.priceUnidad}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center py-2">
                          <div className={cn(
                            "font-black text-[10px] px-2 py-0.5 rounded-lg inline-flex flex-col items-center justify-center min-w-[60px]",
                            p.stock <= 0 ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"
                          )}>
                            <span>{p.stock}</span>
                            <span className="text-[7px] font-normal uppercase">Unidades</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right pr-6 py-2">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl"><MoreVertical className="w-3.5 h-3.5" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-2xl p-2 shadow-2xl border-black/10">
                              <DropdownMenuItem className="text-[9px] font-black uppercase gap-2 cursor-pointer p-3 rounded-xl" onClick={() => onEdit(p.id)}>
                                <Edit2 className="w-3 h-3" style={{ color: brandColor }} /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-[9px] font-black uppercase gap-2 cursor-pointer p-3 rounded-xl text-destructive hover:bg-destructive/10" onClick={() => onDelete({id: p.id, code: p.code})}>
                                <Trash2 className="w-3 h-3" /> Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="movements" className="space-y-6">
          {groupedMovements.map(group => (
            <div key={group.label} className="space-y-2">
              <div className="flex items-center gap-2 px-4 py-1.5 bg-black text-white rounded-xl w-fit shadow-md">
                <Calendar className="w-3.5 h-3.5" style={{ color: brandColor }} />
                <span className="text-[9px] font-black uppercase tracking-widest">{group.label}</span>
              </div>
              <div className="border rounded-2xl bg-white shadow-sm overflow-hidden">
                <Table>
                  <TableBody>
                    {group.items.map(m => (
                      <TableRow key={m.id} className="hover:bg-black/5 transition-colors border-b last:border-0 h-14">
                        <TableCell className="px-6 py-2">
                          <div className="flex justify-between items-center">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className={cn(
                                  "text-[7px] font-black uppercase px-1.5 rounded",
                                  m.type === 'in' || m.type === 'return' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                                )}>
                                  {m.type === 'in' ? 'Entrada' : m.type === 'out' ? 'Salida' : 'Retorno'}
                                </span>
                                <span className="font-black text-[10px] text-black">{m.quantity} UND.</span>
                              </div>
                              <span className="text-[8px] font-normal text-black/40 uppercase leading-tight truncate max-w-[250px]">
                                {m.reason} · {m.productCode}
                              </span>
                            </div>
                            <span className="text-[8px] font-black text-black/20 tabular-nums">
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
        </TabsContent>
      </Tabs>
    </div>
  )
}
