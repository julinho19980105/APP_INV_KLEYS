
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Search, Edit2, X, Trash2, MoreVertical, Check, PackageSearch, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { useCollection, useFirestore } from "@/firebase"
import { collection, query, orderBy, doc, deleteDoc, getDocs, where, writeBatch } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"

const ProductRow = ({ p, onEdit, onDelete }: { 
  p: any, 
  onEdit: (id: string) => void,
  onDelete: (prod: {id: string, code: string}) => void
}) => {
  const [confirming, setConfirming] = React.useState(false);

  const getThumbnailUrl = (url: string) => {
    if (!url || typeof url !== 'string' || !url.startsWith('http')) return url;
    if (!url.includes('id=')) return url;
    const idMatch = url.match(/id=([^&]+)/);
    return idMatch ? `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=300` : url;
  };

  return (
    <TableRow key={p.id} className="group hover:bg-black/5 border-b border-black/5 last:border-0">
      <TableCell className="text-center p-3 w-[60px]">
        <div className="w-12 h-12 rounded-xl border border-black/10 overflow-hidden bg-muted relative shadow-sm">
          {p.images && p.images[0] ? (
             <img src={getThumbnailUrl(p.images[0])} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <PackageSearch className="w-full h-full p-3 opacity-10" />
          )}
        </div>
      </TableCell>
      <TableCell className="p-3">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-black text-[10px] bg-black text-white px-2 rounded-lg">{p.code}</span>
            <span className="font-black text-black text-xs uppercase truncate max-w-[400px]">{p.name}</span>
          </div>
          <div className="text-[10px] font-black text-black/60 uppercase mt-1">
            F: {p.priceFardo} / M: {p.priceMayor} / <span className="text-primary font-black">U: {p.priceUnidad}</span>
            <span className="ml-3 text-[8px] border border-black/10 px-2 rounded-full font-black text-black/40">[{p.collection} | {p.category}]</span>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-center p-3">
        <div className="flex flex-col items-center">
           <span className={cn(
            "font-black text-xs px-3 py-1 rounded-full border shadow-sm",
            p.stock <= 0 ? "bg-destructive text-white border-destructive" : p.stock < 10 ? "bg-orange-50 text-orange-600 border-orange-200" : "bg-green-50 text-green-600 border-green-200"
          )}>
            {p.stock}
          </span>
          <span className="text-[7px] font-black uppercase text-black/30 mt-1">UND</span>
        </div>
      </TableCell>
      <TableCell className="text-right p-3 w-[100px]">
        {confirming ? (
          <div className="flex items-center justify-end gap-1">
            <Button size="icon" variant="ghost" className="h-8 w-8 bg-destructive text-white rounded-xl" onClick={() => { onDelete({id: p.id, code: p.code}); setConfirming(false); }}><Check className="w-4 h-4" /></Button>
            <Button size="icon" variant="ghost" className="h-8 w-8 bg-black/5 rounded-xl" onClick={() => setConfirming(false)}><X className="w-4 h-4" /></Button>
          </div>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-10 w-10 hover:bg-black/10 rounded-xl"><MoreVertical className="w-5 h-5 text-black" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-2xl border-black/10 p-2 shadow-2xl">
              <DropdownMenuItem className="text-[10px] font-black uppercase cursor-pointer p-3 rounded-xl gap-2" onClick={() => onEdit(p.id)}><Edit2 className="w-3.5 h-3.5" /> Editar Prenda</DropdownMenuItem>
              <DropdownMenuItem className="text-[10px] font-black uppercase cursor-pointer p-3 rounded-xl gap-2 text-destructive hover:bg-destructive/10" onClick={() => setConfirming(true)}><Trash2 className="w-3.5 h-3.5" /> Dar de Baja</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </TableCell>
    </TableRow>
  );
};

const MemoizedProductList = React.memo(({ groupedData, onEdit, onDelete }: any) => {
  return (
    <Accordion type="multiple" className="space-y-4">
      {Object.entries(groupedData).map(([mainTitle, items]: [string, any]) => (
        <AccordionItem key={mainTitle} value={mainTitle} className="border-none bg-white rounded-[2rem] shadow-sm px-6">
          <AccordionTrigger className="hover:no-underline py-6">
            <div className="text-sm font-black text-black uppercase tracking-[0.1em]">{mainTitle}</div>
          </AccordionTrigger>
          <AccordionContent className="pb-6 pt-0">
            <div className="border rounded-[1.5rem] border-black/5 overflow-hidden">
              <Table>
                <TableBody>
                  {items.map((p: any) => (
                    <ProductRow 
                      key={p.id} 
                      p={p} 
                      onEdit={onEdit} 
                      onDelete={onDelete}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
});
MemoizedProductList.displayName = "MemoizedProductList";

export default function InventoryPage() {
  const router = useRouter()
  const db = useFirestore()
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = React.useState("")
  const [viewType, setViewType] = React.useState<"collection" | "category">("collection")

  React.useEffect(() => {
    const saved = localStorage.getItem('diva_settings')
    if (saved) {
      const parsed = JSON.parse(saved)
      if (parsed.inventoryViewMode) setViewType(parsed.inventoryViewMode)
    }
  }, [])

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

  const groupedData = React.useMemo(() => {
    const groups: Record<string, any[]> = {}
    filteredProducts.forEach(p => {
      const main = viewType === "collection" ? (p.collection || "SIN COL") : (p.category || "SIN CAT")
      if (!groups[main]) groups[main] = []
      groups[main].push(p)
    })

    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => {
        const subA = viewType === "collection" ? (a.category || "") : (a.collection || "")
        const subB = viewType === "collection" ? (b.category || "") : (b.collection || "")
        return subA.localeCompare(subB)
      })
    })

    return groups
  }, [filteredProducts, viewType])

  const onEdit = React.useCallback((id: string) => router.push(`/registry?edit=${id}`), [router])
  const onDelete = React.useCallback(async (prod: {id: string, code: string}) => {
    if (!db) return
    const pRef = doc(db, "products", prod.id)
    await deleteDoc(pRef)
    const mRef = collection(db, "movements")
    const q = query(mRef, where("productCode", "==", prod.code))
    const snap = await getDocs(q)
    const batch = writeBatch(db)
    snap.forEach(d => batch.delete(d.ref))
    await batch.commit()
    toast({ title: "BAJA PROCESADA", description: "PRENDA Y KARDEX ELIMINADOS." })
  }, [db, toast])

  return (
    <div className="space-y-6 pt-2 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-3xl font-headline font-black text-black uppercase tracking-tight">Stock Actual</h1>
          <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] ml-1 mt-1">Control de Inventario Diva Industrial</p>
        </div>
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-4 h-4 w-4 text-black/40" />
          <Input 
            placeholder="BUSCAR PRENDA O DNI..." 
            className="pl-12 h-12 rounded-[1.25rem] border-black/10 bg-white shadow-sm font-black text-xs uppercase"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="bg-black/5 p-1 rounded-2xl w-full justify-start overflow-hidden border mb-6">
          <TabsTrigger value="all" className="rounded-xl px-10 data-[state=active]:bg-black data-[state=active]:text-white text-[10px] font-black uppercase">Inventario ({viewType.toUpperCase()})</TabsTrigger>
          <TabsTrigger value="movements" className="rounded-xl px-10 data-[state=active]:bg-black data-[state=active]:text-white text-[10px] font-black uppercase">Kardex Maestro</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="space-y-4">
          <MemoizedProductList groupedData={groupedData} onEdit={onEdit} onDelete={onDelete} />
        </TabsContent>

        <TabsContent value="movements">
          <div className="border rounded-[2.5rem] overflow-hidden bg-white shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-black/5 hover:bg-black/5 border-none">
                  <TableHead className="font-black uppercase text-[9px] text-black pl-8"><div className="flex items-center gap-2"><Clock className="w-3 h-3" /> Fecha y Hora</div></TableHead>
                  <TableHead className="font-black uppercase text-[9px] text-black text-center">DNI</TableHead>
                  <TableHead className="font-black uppercase text-[9px] text-black">Operación</TableHead>
                  <TableHead className="text-center font-black uppercase text-[9px] text-black">Cant</TableHead>
                  <TableHead className="font-black uppercase text-[9px] text-black pr-8">Motivo / Referencia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map(m => (
                  <TableRow key={m.id} className="hover:bg-black/5 transition-colors border-b last:border-0">
                    <TableCell className="text-[9px] font-black text-black/60 pl-8">
                      {m.timestamp?.toDate ? m.timestamp.toDate().toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }).toUpperCase() : "---"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="font-black text-[9px] border-black/10 bg-black/5">{m.productCode}</Badge>
                    </TableCell>
                    <TableCell>
                      {m.type === 'in' || m.type === 'return' ? (
                        <span className="text-green-600 font-black text-[10px] uppercase bg-green-50 px-2 py-0.5 rounded-md border border-green-100">Entrada</span>
                      ) : (
                        <span className="text-destructive font-black text-[10px] uppercase bg-destructive/5 px-2 py-0.5 rounded-md border border-destructive/10">Salida</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center font-black text-black text-xs">{m.quantity}</TableCell>
                    <TableCell className="text-[10px] font-black uppercase text-black/70 pr-8">{m.reason}</TableCell>
                  </TableRow>
                ))}
                {movements.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-20 text-[10px] font-black text-black/20 uppercase tracking-widest">Sin movimientos registrados</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
