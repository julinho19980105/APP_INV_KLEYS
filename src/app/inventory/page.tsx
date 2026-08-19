
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog"
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
import { Search, Edit2, ArrowDownRight, ArrowUpRight, X, Trash2, MoreVertical, Check, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { useCollection, useFirestore } from "@/firebase"
import { collection, query, orderBy, limit, doc, deleteDoc, getDocs, where, writeBatch } from "firebase/firestore"
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
    return idMatch ? `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w300` : url;
  };

  return (
    <TableRow key={p.id} className="group hover:bg-black/5">
      <TableCell className="text-center p-2 w-[50px]">
        <div className="w-10 h-10 rounded-lg border border-black/10 overflow-hidden bg-muted relative shadow-sm">
          {p.images && p.images[0] ? (
             <img src={getThumbnailUrl(p.images[0])} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="text-[8px] font-black opacity-20 text-black">N/A</div>
          )}
        </div>
      </TableCell>
      <TableCell className="p-2">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] font-black text-black/50">{p.code}</span>
            <span className="font-black text-black text-xs uppercase truncate max-w-[150px]">{p.name}</span>
          </div>
          <div className="text-[9px] font-bold text-black/60 uppercase">
            F: {p.priceFardo} / M: {p.priceMayor} / <span className="text-primary font-black">U: {p.priceUnidad}</span>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-center p-2">
        <span className={cn(
          "font-black text-xs px-2.5 py-0.5 rounded-full border",
          p.stock <= 0 ? "bg-destructive/10 text-destructive border-destructive/20" : p.stock < 10 ? "bg-orange-50 text-orange-500 border-orange-200" : "bg-green-50 text-green-600 border-green-200"
        )}>
          {p.stock}
        </span>
      </TableCell>
      <TableCell className="text-right p-2 w-[100px]">
        {confirming ? (
          <div className="flex items-center justify-end gap-1">
            <Button size="icon" variant="ghost" className="h-7 w-7 bg-destructive text-white" onClick={() => { onDelete({id: p.id, code: p.code}); setConfirming(false); }}><Check className="w-3.5 h-3.5" /></Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 bg-black/5" onClick={() => setConfirming(false)}><X className="w-3.5 h-3.5" /></Button>
          </div>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-black/10"><MoreVertical className="w-4 h-4 text-black" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl">
              <DropdownMenuItem className="text-[10px] font-black uppercase cursor-pointer" onClick={() => onEdit(p.id)}><Edit2 className="w-3 h-3 mr-2" /> Editar</DropdownMenuItem>
              <DropdownMenuItem className="text-[10px] font-black uppercase cursor-pointer text-destructive" onClick={() => setConfirming(true)}><Trash2 className="w-3 h-3 mr-2" /> Eliminar</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </TableCell>
    </TableRow>
  );
};

const MemoizedProductList = React.memo(({ groupedData, onEdit, onDelete }: any) => {
  return (
    <Accordion type="multiple" className="space-y-2">
      {Object.entries(groupedData).map(([mainTitle, subGroups]: [string, any]) => (
        <AccordionItem key={mainTitle} value={mainTitle} className="border-none bg-white rounded-2xl shadow-sm px-4">
          <AccordionTrigger className="hover:no-underline py-4 px-2">
            <div className="text-sm font-black text-black uppercase tracking-tight">{mainTitle}</div>
          </AccordionTrigger>
          <AccordionContent className="pb-4 pt-0">
            <Accordion type="multiple" className="space-y-2 mt-2 ml-2">
              {Object.entries(subGroups).map(([subTitle, items]: [string, any]) => (
                <AccordionItem key={subTitle} value={subTitle} className="border rounded-xl border-black/5 overflow-hidden">
                  <AccordionTrigger className="py-2 px-4 bg-black/5 hover:no-underline">
                    <span className="text-xs font-black text-black uppercase">{subTitle}</span>
                  </AccordionTrigger>
                  <AccordionContent className="p-0">
                    <Table>
                      <TableBody>
                        {items.map((p: any) => <ProductRow key={p.id} p={p} onEdit={onEdit} onDelete={onDelete} />)}
                      </TableBody>
                    </Table>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
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

  const filteredProducts = products.filter(p => 
    p.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.code?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const groupedData = React.useMemo(() => {
    const groups: Record<string, Record<string, any[]>> = {}
    filteredProducts.forEach(p => {
      const main = viewType === "collection" ? (p.collection || "SIN COL") : (p.category || "SIN CAT")
      const sub = viewType === "collection" ? (p.category || "SIN CAT") : (p.collection || "SIN COL")
      if (!groups[main]) groups[main] = {}
      if (!groups[main][sub]) groups[main][sub] = []
      groups[main][sub].push(p)
    })
    return groups
  }, [filteredProducts, viewType])

  const onEdit = React.useCallback((id: string) => router.push(`/registry?edit=${id}`), [router])
  const onDelete = React.useCallback(async (prod: {id: string, code: string}) => {
    if (!db) return
    const pRef = doc(db, "products", prod.id)
    await deleteDoc(pRef)
    const mRef = collection(db, "movements")
    const q = query(mRef, where("productCode", "==", prod.code), where("type", "in", ["in", "return"]))
    const snap = await getDocs(q)
    const batch = writeBatch(db)
    snap.forEach(d => batch.delete(d.ref))
    await batch.commit()
    toast({ title: "Baja procesada" })
  }, [db, toast])

  return (
    <div className="space-y-4 pt-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black" />
        <Input 
          placeholder="BUSCAR DNI / NOMBRE..." 
          className="pl-10 h-10 rounded-xl border-black/10 bg-white shadow-sm font-black text-black uppercase"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="bg-black/5 p-1 rounded-2xl w-full justify-start overflow-hidden border">
          <TabsTrigger value="all" className="rounded-xl px-8 data-[state=active]:bg-black data-[state=active]:text-white text-[10px] font-black uppercase">STOCK ACTUAL</TabsTrigger>
          <TabsTrigger value="movements" className="rounded-xl px-8 data-[state=active]:bg-black data-[state=active]:text-white text-[10px] font-black uppercase">KARDEX</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="space-y-4 pt-2">
          <MemoizedProductList groupedData={groupedData} onEdit={onEdit} onDelete={onDelete} />
        </TabsContent>

        <TabsContent value="movements" className="pt-2">
          <div className="border rounded-[2rem] overflow-hidden bg-white shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-black/5">
                  <TableHead className="font-black uppercase text-[9px] text-black">Fecha</TableHead>
                  <TableHead className="font-black uppercase text-[9px] text-black">DNI</TableHead>
                  <TableHead className="font-black uppercase text-[9px] text-black">Op</TableHead>
                  <TableHead className="text-center font-black uppercase text-[9px] text-black">Cant</TableHead>
                  <TableHead className="font-black uppercase text-[9px] text-black">Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map(m => (
                  <TableRow key={m.id}>
                    <TableCell className="text-[9px] font-black text-black">{m.timestamp?.toDate ? m.timestamp.toDate().toLocaleString() : ""}</TableCell>
                    <TableCell className="font-mono text-[10px] font-black text-black">{m.productCode}</TableCell>
                    <TableCell>
                      {m.type === 'in' || m.type === 'return' ? <span className="text-green-600 font-black text-[9px]">ENTRADA</span> : <span className="text-destructive font-black text-[9px]">SALIDA</span>}
                    </TableCell>
                    <TableCell className="text-center font-black text-black">{m.quantity}</TableCell>
                    <TableCell className="text-[9px] font-black uppercase text-black">{m.reason}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
