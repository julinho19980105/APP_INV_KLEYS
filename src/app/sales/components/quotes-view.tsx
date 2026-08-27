
"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { 
  Trash2, 
  Plus, 
  Search, 
  Save, 
  Loader2, 
  PackageSearch,
  X,
  Calculator,
  ImageIcon,
  UserPlus,
  MoreVertical,
  Edit2,
  RotateCcw
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useCollection, useDoc } from "@/firebase"
import { 
  collection, 
  query, 
  orderBy, 
  addDoc, 
  serverTimestamp, 
  doc, 
  updateDoc, 
  increment, 
  getDocs, 
  limit, 
  setDoc,
  getDoc
} from "firebase/firestore"
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import { cn } from "@/lib/utils"

interface QuoteItem {
  id: string
  productId: string
  name: string
  description: string
  quantity: string
  price: string
  stock: number
  img: string
  discount: string
  isRegistered: boolean
  calcUnidades?: string
  calcSeries?: string
  calcLibres?: string
  manualNote?: string
  refFardo?: number
  refMayor?: number
  refUnidad?: number
}

const EMPTY_ENTRY: QuoteItem = {
  id: "",
  productId: "",
  name: "",
  description: "",
  quantity: "",
  price: "",
  stock: 0,
  img: "",
  discount: "",
  isRegistered: false,
  calcUnidades: "",
  calcSeries: "",
  calcLibres: "",
  manualNote: ""
}

function getDriveThumb(url: string, size: number = 400) {
  if (!url || !url.includes('drive.google.com')) return url;
  let fileId = '';
  const idMatch = url.match(/[?&]id=([^&]+)/);
  if (idMatch && idMatch[1]) fileId = idMatch[1];
  else {
    const dMatch = url.match(/\/d\/([^/]+)/);
    if (dMatch && dMatch[1]) fileId = dMatch[1];
  }
  return fileId ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}` : url;
}

const STORAGE_KEY = "stilo_quote_draft";

export default function QuotesView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('edit')
  const { toast } = useToast()
  const db = useFirestore()
  
  const configDocRef = React.useMemo(() => db ? doc(db, "config", "global") : null, [db])
  const { data: config } = useDoc(configDocRef)
  const brandColor = config?.brandColor || "#FF3399"

  const [saving, setSaving] = React.useState(false)
  const [quoteId, setQuoteId] = React.useState("B-001")
  const [customerQuery, setCustomerQuery] = React.useState("")
  const [selectedCustomer, setSelectedCustomer] = React.useState<{id: string, name: string} | null>(null)
  const [productQuery, setProductQuery] = React.useState("")
  
  const [currentEntry, setCurrentEntry] = React.useState<QuoteItem>(EMPTY_ENTRY)
  const [items, setItems] = React.useState<QuoteItem[]>([])
  const [oldItems, setOldItems] = React.useState<QuoteItem[]>([])
  const [editQuoteStatus, setEditQuoteStatus] = React.useState<string | null>(null)
  
  const [isCalcOpen, setIsCalcOpen] = React.useState(false)
  const [calcData, setCalcData] = React.useState({ unidades: "", series: "", libres: "" })
  const [zoomImage, setZoomImage] = React.useState<string | null>(null)
  const [registeringCustomer, setRegisteringCustomer] = React.useState(false)
  const [isInitialized, setIsInitialized] = React.useState(false)

  const productsRef = React.useMemo(() => db ? query(collection(db, "products"), orderBy("code")) : null, [db])
  const customersRef = React.useMemo(() => db ? query(collection(db, "customers"), orderBy("id")) : null, [db])
  const { data: dbProducts = [] } = useCollection(productsRef)
  const { data: dbCustomers = [] } = useCollection(customersRef)

  React.useEffect(() => {
    if (typeof window !== "undefined" && !editId) {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setSelectedCustomer(parsed.selectedCustomer);
          setItems(parsed.items);
          setQuoteId(parsed.quoteId);
        } catch (e) {}
      }
    }
    setIsInitialized(true);
  }, [editId]);

  React.useEffect(() => {
    if (isInitialized && !editId && typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        selectedCustomer,
        items,
        quoteId
      }));
    }
  }, [selectedCustomer, items, quoteId, isInitialized, editId]);

  React.useEffect(() => {
    if (!db || editId) return
    const getNextId = async () => {
      const q = query(collection(db, "quotes"), orderBy("id", "desc"), limit(1))
      const snap = await getDocs(q)
      if (!snap.empty) {
        const lastId = snap.docs[0].id
        const lastNum = parseInt(lastId.split('-')[1]) || 0
        setQuoteId(`B-${(lastNum + 1).toString().padStart(3, '0')}`)
      }
    }
    getNextId()
  }, [db, editId])

  React.useEffect(() => {
    if (db && editId) {
      getDoc(doc(db, "quotes", editId)).then(snap => {
        if (snap.exists()) {
          const data = snap.data()
          setQuoteId(data.id)
          setSelectedCustomer({ id: data.customerId, name: data.customerName })
          setItems(data.items || [])
          setOldItems(data.items || [])
          setEditQuoteStatus(data.status || 'active')
        }
      })
    }
  }, [db, editId])

  const customerSuggestions = React.useMemo(() => {
    if (customerQuery.length < 1) return []
    const q = customerQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    return dbCustomers.filter(c => 
      c.name?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q) ||
      c.id.toLowerCase().includes(q)
    )
  }, [customerQuery, dbCustomers])

  const productSuggestions = React.useMemo(() => {
    if (productQuery.length < 1) return []
    const q = productQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    return dbProducts.filter(p => 
      p.name?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q) || 
      p.code?.toLowerCase().includes(q)
    )
  }, [productQuery, dbProducts])

  const handleQuickRegisterCustomer = async () => {
    if (!db || !customerQuery.trim()) return
    setRegisteringCustomer(true)
    try {
      const q = query(collection(db, "customers"), orderBy("id", "desc"), limit(1))
      const snap = await getDocs(q)
      let nextCustId = "CL-001"
      if (!snap.empty) {
        const lastId = snap.docs[0].id
        const lastNum = parseInt(lastId.split('-')[1]) || 0
        nextCustId = `CL-${(lastNum + 1).toString().padStart(3, '0')}`
      }
      const name = customerQuery.toUpperCase().trim()
      await setDoc(doc(db, "customers", nextCustId), { 
        id: nextCustId, 
        name, 
        phone: "", 
        location: "", 
        createdAt: serverTimestamp() 
      })
      setSelectedCustomer({ id: nextCustId, name })
      setCustomerQuery("")
      toast({ title: "Cliente Registrado" })
    } catch (e) {
      toast({ variant: "destructive", title: "Error" })
    } finally {
      setRegisteringCustomer(false)
    }
  }

  const selectProductForEntry = (prod: any) => {
    setCurrentEntry({
      id: Math.random().toString(),
      productId: prod.code,
      name: prod.name,
      description: "",
      quantity: "",
      price: prod.priceMayor?.toString() || "",
      stock: prod.stock || 0,
      img: prod.images?.[0] || "",
      discount: "",
      isRegistered: true,
      calcUnidades: "",
      calcSeries: "",
      calcLibres: "",
      manualNote: "",
      refFardo: prod.priceFardo,
      refMayor: prod.priceMayor,
      refUnidad: prod.priceUnidad
    })
    setProductQuery("")
  }

  const handleApplyCalc = () => {
    const u = Number(calcData.unidades || 0)
    const s = Number(calcData.series || 0)
    const l = Number(calcData.libres || 0)
    const total = (u * s) + l
    const desc = `${u} UNID X ${s} SERIES${l > 0 ? ` + ${l}` : ''}. `
    setCurrentEntry({ 
      ...currentEntry, 
      quantity: total.toString(), 
      description: desc + (currentEntry.manualNote || ""),
      calcUnidades: calcData.unidades,
      calcSeries: calcData.series,
      calcLibres: calcData.libres
    })
    setIsCalcOpen(false)
  }

  const handleSaveQuote = async () => {
    if (!db || !selectedCustomer || items.length === 0) {
      if (!selectedCustomer) toast({ variant: "destructive", title: "CLIENTE OBLIGATORIO" })
      return
    }
    setSaving(true)
    try {
      if (editId && oldItems.length > 0 && editQuoteStatus !== 'annulled') {
        for (const item of oldItems) {
          if (item.isRegistered && item.productId !== "MANUAL") {
            const prodRef = doc(db, "products", item.productId)
            updateDoc(prodRef, {
              stock: increment(Number(item.quantity)),
              updatedAt: serverTimestamp()
            }).catch(() => {});
            
            addDoc(collection(db, "movements"), {
              productCode: item.productId,
              type: "return",
              quantity: Number(item.quantity),
              reason: `REINTEGRO POR EDICIÓN BOLETA ${quoteId}`,
              timestamp: serverTimestamp(),
              referenceId: quoteId
            }).catch(() => {});
          }
        }
      }

      const total = items.reduce((acc, i) => acc + (Number(i.quantity) * Number(i.price) - Number(i.discount)), 0)
      const subtotal = items.reduce((acc, i) => acc + (Number(i.quantity) * Number(i.price)), 0)
      
      const quoteData = {
        id: quoteId,
        customerName: selectedCustomer.name,
        customerId: selectedCustomer.id,
        items: items,
        subtotal: subtotal,
        total: total,
        status: editQuoteStatus === 'shipped' ? 'shipped' : 'active',
        createdAt: serverTimestamp()
      }

      await setDoc(doc(db, "quotes", quoteId), quoteData)

      for (const item of items) {
        if (item.isRegistered && item.productId !== "MANUAL") {
          const prodRef = doc(db, "products", item.productId)
          updateDoc(prodRef, {
            stock: increment(-Number(item.quantity)),
            updatedAt: serverTimestamp()
          }).catch(async () => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: prodRef.path, operation: 'update' }));
          });

          addDoc(collection(db, "movements"), {
            productCode: item.productId,
            type: "out",
            quantity: Number(item.quantity),
            reason: `SALIDA POR VENTA ${quoteId}`,
            timestamp: serverTimestamp(),
            referenceId: quoteId
          }).catch(async () => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'movements', operation: 'create' }));
          });
        }
      }

      if (typeof window !== "undefined") {
        localStorage.removeItem(STORAGE_KEY);
      }
      toast({ title: editId ? "VENTA ACTUALIZADA" : "VENTA REGISTRADA" })
      if (editId) router.push('/sales')
      else handleDiscard()
    } catch (e) {
      toast({ variant: "destructive", title: "ERROR AL GUARDAR" })
    } finally {
      setSaving(false)
    }
  }

  const handleDiscard = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
    setSelectedCustomer(null);
    setItems([]);
    setQuoteId("B-001");
    setCurrentEntry(EMPTY_ENTRY);
    setCustomerQuery("");
    setProductQuery("");
  }

  const handleEditItem = (item: QuoteItem) => {
    setCurrentEntry({...item});
    setItems(items.filter(i => i.id !== item.id));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const handleDeleteItem = (itemId: string) => {
    setItems(items.filter(i => i.id !== itemId));
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center border-b-2 border-primary/20 pb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-headline font-black text-foreground uppercase tracking-tight">Registro Comercial</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xl font-headline font-black text-primary uppercase">{quoteId}</span>
          <Button variant="ghost" size="icon" onClick={handleDiscard} className="h-9 w-9 text-primary/40"><RotateCcw className="w-5 h-5" /></Button>
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-[10px] uppercase text-primary font-black ml-1 tracking-widest">CLIENTE</Label>
        <div className="relative flex gap-2">
          <div className="relative flex-1">
            <Input 
              placeholder="Nombre o ID..." 
              className="h-12 text-xs font-black uppercase rounded-xl border-primary/10 bg-white shadow-sm"
              value={selectedCustomer ? `${selectedCustomer.name} [${selectedCustomer.id}]` : customerQuery}
              onChange={e => { if (selectedCustomer) setSelectedCustomer(null); setCustomerQuery(e.target.value); }}
            />
            {customerSuggestions.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-primary/10 rounded-xl shadow-2xl overflow-hidden">
                {customerSuggestions.map(c => (
                  <button key={c.id} className="w-full text-left px-4 py-4 hover:bg-primary/5 border-b last:border-0" onClick={() => { setSelectedCustomer({ id: c.id, name: c.name }); setCustomerQuery(""); }}>
                    <span className="text-[11px] font-black uppercase text-foreground">{c.name} <span className="ml-1 text-primary">[{c.id}]</span></span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {!selectedCustomer && customerQuery.length >= 1 && (
            <Button className="h-12 w-12 rounded-xl bg-primary text-white shadow-lg" onClick={handleQuickRegisterCustomer} disabled={registeringCustomer}>
              {registeringCustomer ? <Loader2 className="animate-spin w-4 h-4" /> : <UserPlus className="w-5 h-5" />}
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-[10px] uppercase font-black text-primary ml-1 tracking-widest">BUSCAR PRENDA</Label>
        <div className="relative">
          <Search className="absolute left-4 top-4 h-4 w-4 text-primary/40" />
          <Input 
            placeholder="CÓDIGO O NOMBRE..." 
            className="pl-11 h-12 rounded-xl border-primary/10 font-black text-xs uppercase bg-white shadow-sm" 
            value={productQuery} 
            onChange={e => setProductQuery(e.target.value)} 
          />
          {productQuery.length >= 1 && (
            <div className="absolute z-50 w-full mt-2 bg-white border border-primary/10 rounded-2xl shadow-2xl overflow-hidden">
              {productSuggestions.map(p => (
                <div key={p.code} className="w-full text-left px-4 py-3 hover:bg-primary/5 flex items-center gap-3 border-b last:border-0 group">
                  <div className="w-12 h-12 rounded-lg border border-primary/10 overflow-hidden bg-secondary cursor-pointer shrink-0" onClick={(e) => { e.stopPropagation(); setZoomImage(p.images?.[0] || null); }}>
                    {p.images?.[0] ? <img src={getDriveThumb(p.images[0], 200)} className="w-full h-full object-cover" /> : <ImageIcon className="w-full h-full p-3 opacity-20" />}
                  </div>
                  <button className="flex-1 min-w-0 text-left" onClick={() => selectProductForEntry(p)}>
                    <div className="font-black text-[11px] text-foreground uppercase">{p.name}</div>
                    <div className="text-[8px] font-black text-muted-foreground uppercase">{p.code} • STOCK: {p.stock}</div>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Card className="rounded-[2rem] border-2 border-primary/20 bg-white overflow-hidden shadow-2xl">
        <CardContent className="p-5 md:p-8 space-y-5">
           <div className="flex gap-4 items-center">
             <div className="w-20 h-20 rounded-2xl border bg-muted overflow-hidden flex items-center justify-center shrink-0 cursor-pointer" onClick={() => setZoomImage(currentEntry.img)}>
                {currentEntry.img ? <img src={getDriveThumb(currentEntry.img, 200)} className="w-full h-full object-cover" /> : <PackageSearch className="w-8 h-8 opacity-20" />}
             </div>
             <div className="flex-1 min-w-0">
                <Input value={currentEntry.name} onChange={e => setCurrentEntry({...currentEntry, name: e.target.value.toUpperCase()})} placeholder="PRENDA..." className="h-10 text-sm font-black uppercase border-none p-0 focus-visible:ring-0 shadow-none" />
                <div className="text-[9px] font-black text-primary/40 uppercase">{currentEntry.productId || "MANUAL"}</div>
             </div>
           </div>

           <div className="flex gap-2 pb-1">
             <Button variant="outline" className="flex-1 h-10 text-[9px] font-black uppercase border-primary/10" onClick={() => setCurrentEntry({...currentEntry, price: currentEntry.refFardo?.toString() || ""})}>Fardo: {currentEntry.refFardo?.toFixed(1) || '-'}</Button>
             <Button variant="outline" className="flex-1 h-10 text-[9px] font-black uppercase border-primary/10 bg-primary/5" onClick={() => setCurrentEntry({...currentEntry, price: currentEntry.refMayor?.toString() || ""})}>Mayor: {currentEntry.refMayor?.toFixed(1) || '-'}</Button>
             <Button variant="outline" className="flex-1 h-10 text-[9px] font-black uppercase border-primary/10" onClick={() => setCurrentEntry({...currentEntry, price: currentEntry.refUnidad?.toString() || ""})}>Unid: {currentEntry.refUnidad?.toFixed(1) || '-'}</Button>
           </div>

           <div className="grid grid-cols-3 gap-3">
             <div className="space-y-1">
               <Label className="text-[9px] font-black text-muted-foreground uppercase ml-1">PRECIO</Label>
               <Input type="number" value={currentEntry.price} onChange={e => setCurrentEntry({...currentEntry, price: e.target.value})} className="h-12 font-black text-sm rounded-xl border-primary/10" />
             </div>
             <div className="space-y-1">
               <Label className="text-[9px] font-black text-muted-foreground uppercase ml-1">CANT</Label>
               <div className="flex gap-1">
                 <Input type="number" value={currentEntry.quantity} onChange={e => setCurrentEntry({...currentEntry, quantity: e.target.value})} className="h-12 font-black text-sm rounded-xl border-primary/10" />
                 <Button variant="outline" size="icon" className="h-12 w-12 shrink-0 rounded-xl" onClick={() => setIsCalcOpen(true)}><Calculator className="w-4 h-4" /></Button>
               </div>
             </div>
             <div className="space-y-1">
               <Label className="text-[9px] font-black text-muted-foreground uppercase ml-1">DESC.</Label>
               <Input type="number" value={currentEntry.discount} onChange={e => setCurrentEntry({...currentEntry, discount: e.target.value})} className="h-12 font-black text-sm rounded-xl border-orange-100 bg-orange-50 text-orange-600" />
             </div>
           </div>

           <div className="space-y-1">
             <Label className="text-[9px] font-black text-muted-foreground uppercase ml-1">DESCRIPCIÓN</Label>
             <Input value={currentEntry.description} onChange={e => setCurrentEntry({...currentEntry, description: e.target.value})} placeholder="Detalles..." className="h-12 rounded-xl border-none bg-primary/5" />
           </div>

           <Button 
            className="w-full h-14 bg-primary text-white rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all"
            onClick={() => {
              if (!currentEntry.name || !currentEntry.price || !currentEntry.quantity) return;
              setItems([...items, { ...currentEntry, id: Math.random().toString() }]);
              setCurrentEntry(EMPTY_ENTRY);
            }}
           >
             <Plus className="w-5 h-5 mr-2" /> AGREGAR A LISTA
           </Button>
        </CardContent>
      </Card>

      <Card className="rounded-[2.5rem] border border-primary/10 shadow-sm bg-white overflow-hidden">
        <div className="bg-primary/5 p-4 border-b border-primary/10">
          <span className="text-[10px] font-black uppercase text-primary tracking-widest">RESUMEN</span>
        </div>
        <div className="divide-y divide-primary/5">
          {items.map((item, index) => (
            <div key={item.id} className="p-4 flex justify-between items-center group">
              <div className="min-w-0 flex-1">
                <div className="font-black text-[11px] uppercase truncate">{index + 1}- {item.name} <span className="text-primary/40">[{item.productId}]</span></div>
                <div className="text-[9px] font-medium text-muted-foreground mt-0.5">{item.description || "-"}</div>
                <div className="text-[9px] font-black text-primary uppercase mt-1">{item.quantity} UND x S/ {Number(item.price).toFixed(1)} {Number(item.discount) > 0 ? `| DESC S/ ${Number(item.discount).toFixed(1)}` : ""}</div>
              </div>
              <div className="flex items-center gap-4 ml-4">
                <div className="font-headline font-black text-sm whitespace-nowrap">S/ {((Number(item.price) * Number(item.quantity)) - Number(item.discount)).toFixed(1)}</div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-xl p-1.5 w-32 shadow-xl">
                    <DropdownMenuItem className="text-[10px] font-black uppercase gap-2 p-2.5" onClick={() => handleEditItem(item)}><Edit2 className="w-3.5 h-3.5" /> Editar</DropdownMenuItem>
                    <DropdownMenuItem className="text-[10px] font-black uppercase gap-2 p-2.5 text-destructive" onClick={() => handleDeleteItem(item.id)}><Trash2 className="w-3.5 h-3.5" /> Eliminar</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="border-t-4 border-primary pt-6 flex flex-row justify-between items-center gap-4">
        <div className="flex-1">
          <div className="text-[10px] font-black uppercase text-muted-foreground">TOTAL PRENDAS</div>
          <div className="font-headline font-black text-3xl">{items.reduce((acc, i) => acc + Number(i.quantity), 0)}</div>
        </div>
        <div className="flex-1 text-right">
          <div className="text-[10px] font-black uppercase text-muted-foreground">MONTO TOTAL</div>
          <div className="font-headline font-black text-3xl text-primary">S/ {items.reduce((acc, i) => acc + (Number(i.quantity) * Number(i.price) - Number(i.discount)), 0).toFixed(1)}</div>
        </div>
      </div>

      <Button 
        className="w-full h-16 bg-primary text-white rounded-[2rem] font-black text-base uppercase shadow-2xl active:scale-95 transition-all mt-4" 
        onClick={handleSaveQuote} 
        disabled={saving || items.length === 0}
      >
        {saving ? <Loader2 className="animate-spin" /> : <Save className="w-6 h-6 mr-3" />} GUARDAR VENTA
      </Button>

      <Dialog open={isCalcOpen} onOpenChange={setIsCalcOpen}>
        <DialogContent className="rounded-[2.5rem] border-none shadow-2xl max-w-[320px] p-8">
          <DialogHeader><DialogTitle className="text-xs font-black uppercase text-center">Cálculo de Series</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-[9px] font-black uppercase text-muted-foreground">Unid x Serie</Label><Input type="number" value={calcData.unidades} onChange={e => setCalcData({...calcData, unidades: e.target.value})} className="h-12 text-center border-primary/10 rounded-xl" /></div>
              <div className="space-y-1"><Label className="text-[9px] font-black uppercase text-muted-foreground">N° Series</Label><Input type="number" value={calcData.series} onChange={e => setCalcData({...calcData, series: e.target.value})} className="h-12 text-center border-primary/10 rounded-xl" /></div>
            </div>
            <div className="space-y-1"><Label className="text-[9px] font-black uppercase text-muted-foreground">+ Unid Libres</Label><Input type="number" value={calcData.libres} onChange={e => setCalcData({...calcData, libres: e.target.value})} className="h-12 text-center border-primary/10 rounded-xl" /></div>
            <div className="bg-primary/5 p-4 rounded-xl text-center">
              <div className="text-2xl font-black text-primary">{(Number(calcData.unidades) * Number(calcData.series)) + Number(calcData.libres)} UND</div>
            </div>
            <Button className="w-full h-12 bg-primary text-white rounded-xl font-black" onClick={handleApplyCalc}>CONFIRMAR</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!zoomImage} onOpenChange={() => setZoomImage(null)}>
        <DialogContent className="max-w-[95vw] md:max-w-4xl p-0 border-none bg-transparent shadow-none">
          <DialogHeader className="sr-only"><DialogTitle>Vista de Prenda</DialogTitle></DialogHeader>
          <div className="relative w-full aspect-square md:aspect-video flex items-center justify-center bg-black/95 rounded-[2.5rem] overflow-hidden">
            <button onClick={() => setZoomImage(null)} className="absolute top-6 right-6 z-50 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all active:scale-90"><X className="w-8 h-8" /></button>
            {zoomImage && <img src={getDriveThumb(zoomImage, 2000)} className="max-w-full max-h-full object-contain" alt="Zoom" />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
