
"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { 
  Trash2, 
  Plus, 
  Search, 
  ShoppingCart, 
  Save, 
  Printer, 
  Loader2, 
  UserPlus, 
  PackageSearch,
  Check,
  X,
  Edit2
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { useFirestore, useCollection } from "@/firebase"
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
  where 
} from "firebase/firestore"

interface QuoteItem {
  id: string
  productId: string
  name: string
  description: string
  quantity: string
  price: string
  priceType: 'fardo' | 'mayor' | 'unidad' | 'custom'
  stock: number
  img: string
  discount: string
  isRegistered: boolean
}

export default function QuotesPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const [saving, setSaving] = React.useState(false)
  const [quoteId, setQuoteId] = React.useState("B-001")
  const [customerQuery, setCustomerQuery] = React.useState("")
  const [selectedCustomer, setSelectedCustomer] = React.useState<{id: string, name: string} | null>(null)
  const [productQuery, setProductQuery] = React.useState("")
  const [items, setItems] = React.useState<QuoteItem[]>([])
  const [globalDiscount, setGlobalDiscount] = React.useState("")
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null)
  const [editingItemId, setEditingItemId] = React.useState<string | null>(null)

  const productsRef = React.useMemo(() => db ? query(collection(db, "products"), orderBy("code")) : null, [db])
  const customersRef = React.useMemo(() => db ? query(collection(db, "customers"), orderBy("id")) : null, [db])
  
  const { data: dbProducts = [] } = useCollection(productsRef)
  const { data: dbCustomers = [] } = useCollection(customersRef)

  const fetchNextQuoteId = React.useCallback(async () => {
    if (!db) return
    const q = query(collection(db, "quotes"), orderBy("id", "desc"), limit(1))
    const snap = await getDocs(q)
    if (!snap.empty) {
      const lastId = snap.docs[0].id
      const match = lastId.match(/\d+/)
      const lastNum = match ? parseInt(match[0]) : 0
      setQuoteId(`B-${(lastNum + 1).toString().padStart(3, '0')}`)
    } else {
      setQuoteId("B-001")
    }
  }, [db])

  React.useEffect(() => {
    fetchNextQuoteId()
  }, [fetchNextQuoteId])

  const customerSuggestions = React.useMemo(() => {
    if (customerQuery.length < 2) return []
    const q = customerQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    return dbCustomers.filter(c => 
      c.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q) ||
      c.id.toLowerCase().includes(q)
    )
  }, [customerQuery, dbCustomers])

  const productSuggestions = React.useMemo(() => {
    if (productQuery.length < 2) return []
    const q = productQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    return dbProducts.filter(p => 
      p.name?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q) || 
      p.code?.toLowerCase().includes(q)
    )
  }, [productQuery, dbProducts])

  const registerNewCustomer = async () => {
    if (!db || !customerQuery.trim()) return
    setSaving(true)
    try {
      const q = query(collection(db, "customers"), orderBy("id", "desc"), limit(1))
      const snap = await getDocs(q)
      let nextId = "CL-001"
      if (!snap.empty) {
        const lastId = snap.docs[0].id
        const match = lastId.match(/\d+/)
        const lastNum = match ? parseInt(match[0]) : 0
        nextId = `CL-${(lastNum + 1).toString().padStart(3, '0')}`
      }
      
      const newCustomer = {
        id: nextId,
        name: customerQuery.toUpperCase().trim(),
        createdAt: serverTimestamp()
      }
      
      await setDoc(doc(db, "customers", nextId), newCustomer)
      setSelectedCustomer({ id: nextId, name: newCustomer.name })
      setCustomerQuery("")
      toast({ title: "CLIENTE REGISTRADO", description: `${newCustomer.name} [${nextId}] ASIGNADO.` })
    } catch (e) {
      toast({ variant: "destructive", title: "ERROR AL REGISTRAR" })
    } finally {
      setSaving(false)
    }
  }

  const addItem = (prod: any) => {
    if (items.find(i => i.productId === prod.code && i.isRegistered)) return
    setItems([...items, {
      id: Math.random().toString(),
      productId: prod.code,
      name: prod.name,
      description: "",
      quantity: "",
      price: prod.priceMayor?.toString() || "0",
      priceType: 'mayor',
      stock: prod.stock || 0,
      img: prod.images?.[0] || "",
      discount: "",
      isRegistered: true
    }])
    setProductQuery("")
  }

  const addUnregisteredItem = () => {
    setItems([...items, {
      id: Math.random().toString(),
      productId: "MANUAL",
      name: productQuery.toUpperCase().trim() || "PRODUCTO MANUAL",
      description: "",
      quantity: "",
      price: "0",
      priceType: 'custom',
      stock: 9999,
      img: "",
      discount: "",
      isRegistered: false
    }])
    setProductQuery("")
  }

  const updateItem = (id: string, updates: Partial<QuoteItem>) => {
    setItems(items.map(i => {
      if (i.id === id) {
        const updated = { ...i, ...updates }
        if (updated.isRegistered && Number(updated.quantity) > updated.stock) {
          toast({ variant: "destructive", title: "STOCK INSUFICIENTE", description: `Máximo disponible: ${updated.stock}` })
          return { ...updated, quantity: updated.stock.toString() }
        }
        return updated
      }
      return i
    }))
  }

  const handleRegisterSale = async () => {
    if (!db || items.length === 0 || (!selectedCustomer && !customerQuery)) return
    const finalCustomerName = selectedCustomer ? `${selectedCustomer.name} [${selectedCustomer.id}]` : customerQuery.toUpperCase().trim()
    setSaving(true)
    try {
      await setDoc(doc(db, "quotes", quoteId), {
        id: quoteId,
        customerName: finalCustomerName,
        customerId: selectedCustomer?.id || "GENERIC",
        items: items.map(i => ({...i, quantity: Number(i.quantity || 0), price: Number(i.price || 0), discount: Number(i.discount || 0)})),
        subtotal: subtotal,
        discount: Number(globalDiscount || 0),
        total: finalTotal,
        status: 'active',
        createdAt: serverTimestamp()
      })

      for (const item of items) {
        if (item.isRegistered) {
          const qty = Number(item.quantity || 0)
          updateDoc(doc(db, "products", item.productId), { stock: increment(-qty) })
          addDoc(collection(db, "movements"), {
            productCode: item.productId,
            type: "out",
            quantity: qty,
            reason: `VENTA ${quoteId}`,
            timestamp: serverTimestamp()
          })
        }
      }

      toast({ title: "VENTA REGISTRADA", description: `BOLETA ${quoteId} GUARDADA.` })
      setItems([]); setSelectedCustomer(null); setCustomerQuery(""); fetchNextQuoteId()
    } catch (e) {
      toast({ variant: "destructive", title: "ERROR CRÍTICO" })
    } finally {
      setSaving(false)
    }
  }

  const subtotal = items.reduce((acc, item) => {
    const lineSub = Number(item.quantity || 0) * Number(item.price || 0)
    return acc + (lineSub - Number(item.discount || 0))
  }, 0)
  
  const finalTotal = subtotal - Number(globalDiscount || 0)

  const getThumbnailUrl = (url: string) => {
    if (!url || typeof url !== 'string' || !url.startsWith('http')) return url;
    const idMatch = url.match(/id=([^&]+)/);
    return idMatch ? `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=300` : url;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 pt-2">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-headline font-black text-black uppercase tracking-tight">COTIZACIÓN</h1>
          <Badge variant="outline" className="text-[8px] font-black border-black/20 uppercase tracking-[0.2em] px-3 mt-1">Industrial Serie {quoteId}</Badge>
        </div>
        <Button variant="outline" className="rounded-xl border-black text-black font-black h-10 px-6" size="sm"><Printer className="w-4 h-4 mr-2" /> TICKET</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-4">
          <Card className="rounded-[2rem] border shadow-sm bg-white overflow-hidden">
            <CardHeader className="bg-black/5 border-b py-4 px-8">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1 space-y-1">
                  <Label className="text-[9px] uppercase text-black font-black tracking-widest ml-1">CLIENTE</Label>
                  <div className="relative">
                    <Input 
                      placeholder="BUSCAR O REGISTRAR..." 
                      className="h-10 text-xs font-black text-black uppercase rounded-xl border-black/10"
                      value={selectedCustomer ? `${selectedCustomer.name} [${selectedCustomer.id}]` : customerQuery}
                      onChange={e => { if (selectedCustomer) setSelectedCustomer(null); setCustomerQuery(e.target.value); }}
                    />
                    {customerQuery.length >= 2 && !selectedCustomer && (
                      <button onClick={registerNewCustomer} className="absolute right-2 top-2 h-6 w-6 bg-primary rounded-lg flex items-center justify-center text-white shadow-sm"><UserPlus className="w-3.5 h-3.5" /></button>
                    )}
                    {customerSuggestions.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white border rounded-xl shadow-xl overflow-hidden">
                        {customerSuggestions.map(c => (
                          <button key={c.id} className="w-full text-left px-4 py-3 hover:bg-black/5 flex justify-between border-b last:border-0" onClick={() => { setSelectedCustomer({ id: c.id, name: c.name }); setCustomerQuery(""); }}>
                            <span className="text-[10px] font-black uppercase text-black">{c.name} <span className="text-primary ml-1">[{c.id}]</span></span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="w-48 relative space-y-1">
                  <Label className="text-[9px] uppercase font-black text-black tracking-widest ml-1">BUSCAR PRENDA</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-black/40" />
                    <Input placeholder="DNI..." className="pl-9 h-10 rounded-xl border-black/10 font-black text-xs uppercase" value={productQuery} onChange={e => setProductQuery(e.target.value)} />
                    {productQuery.length >= 2 && (
                      <div className="absolute z-20 w-80 mt-2 bg-white border rounded-2xl shadow-2xl overflow-hidden right-0">
                        {productSuggestions.map(p => (
                          <button key={p.code} className="w-full text-left px-4 py-3 hover:bg-black/5 flex items-center gap-3 border-b last:border-0" onClick={() => addItem(p)}>
                            <div className="w-10 h-10 rounded-lg overflow-hidden border bg-muted shrink-0">
                              {p.images?.[0] ? <img src={getThumbnailUrl(p.images[0])} alt="" className="w-full h-full object-cover" /> : <PackageSearch className="w-full h-full p-2 opacity-20" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-black text-[10px] text-black uppercase truncate">{p.name}</div>
                              <div className="text-[7px] font-black text-black/40 uppercase">{p.code} | {p.category} | {p.collection}</div>
                            </div>
                            <Plus className="w-4 h-4 text-primary" />
                          </button>
                        ))}
                        <button className="w-full px-4 py-3 bg-primary/5 hover:bg-primary/10 text-primary font-black text-[9px] uppercase flex items-center justify-center gap-2" onClick={addUnregisteredItem}>
                          <Plus className="w-3 h-3" /> AGREGAR MANUAL
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-black/5">
                {items.map(item => (
                  <div key={item.id} className="p-4 hover:bg-black/[0.02] transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl overflow-hidden border shrink-0 bg-muted">
                        {item.img ? <img src={getThumbnailUrl(item.img)} className="w-full h-full object-cover" /> : <PackageSearch className="w-full h-full p-3 opacity-10" />}
                      </div>
                      <div className="flex-1 min-w-0 grid grid-cols-12 gap-3 items-center">
                        <div className="col-span-3">
                          <div className="font-black text-[11px] text-black uppercase truncate">{item.name}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[8px] font-black uppercase text-black/40">{item.isRegistered ? item.productId : "MANUAL"}</span>
                            {item.isRegistered && <span className="text-[8px] font-black uppercase text-green-600">STOCK: {item.stock}</span>}
                          </div>
                        </div>
                        <div className="col-span-4">
                          <Input 
                            placeholder="OBSERVACIONES EN UNA LÍNEA..." 
                            className="h-8 text-[9px] font-black uppercase bg-black/5 border-none rounded-lg"
                            value={item.description}
                            onChange={e => updateItem(item.id, { description: e.target.value })}
                          />
                        </div>
                        <div className="col-span-4 flex items-center gap-2">
                          <Input type="number" placeholder="P.U" className="w-16 h-8 text-center text-[10px] font-black border-black/10 rounded-lg" value={item.price} onChange={e => updateItem(item.id, { price: e.target.value })} />
                          <Input type="number" placeholder="CANT" className="w-14 h-8 text-center text-[10px] font-black border-primary/20 bg-primary/5 text-primary rounded-lg" value={item.quantity} onChange={e => updateItem(item.id, { quantity: e.target.value })} />
                          <Input type="number" placeholder="DESC" className="w-14 h-8 text-center text-[10px] font-black border-orange-200 bg-orange-50 text-orange-600 rounded-lg" value={item.discount} onChange={e => updateItem(item.id, { discount: e.target.value })} />
                          <div className="flex-1 text-right font-black text-xs text-black whitespace-nowrap">
                            S/ {((Number(item.price || 0) * Number(item.quantity || 0)) - Number(item.discount || 0)).toFixed(2)}
                          </div>
                        </div>
                        <div className="col-span-1 flex justify-end">
                          {confirmDeleteId === item.id ? (
                            <div className="flex gap-1 animate-in fade-in zoom-in duration-200">
                              <button onClick={() => { setItems(items.filter(i => i.id !== item.id)); setConfirmDeleteId(null); }} className="h-7 w-7 bg-destructive text-white rounded-lg flex items-center justify-center"><Check className="w-3.5 h-3.5" /></button>
                              <button onClick={() => setConfirmDeleteId(null)} className="h-7 w-7 bg-black/5 text-black rounded-lg flex items-center justify-center"><X className="w-3.5 h-3.5" /></button>
                            </div>
                          ) : (
                            <button onClick={() => setConfirmDeleteId(item.id)} className="h-8 w-8 text-black/20 hover:text-destructive transition-colors"><Trash2 className="w-4 h-4" /></button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {items.length === 0 && (
                  <div className="py-20 text-center opacity-10 flex flex-col items-center gap-2">
                    <ShoppingCart className="w-10 h-10" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Sin prendas</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="bg-black text-white border-none shadow-xl rounded-[2.5rem] overflow-hidden">
            <CardContent className="p-8 space-y-6">
              <div className="flex justify-between items-end border-b border-white/10 pb-6">
                <div>
                  <div className="text-[8px] uppercase font-black text-white/40">NETO S/</div>
                  <div className="font-headline font-black text-4xl tracking-tighter">S/ {finalTotal.toFixed(2)}</div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between text-[11px] font-black uppercase">
                  <span className="text-white/40">SUBTOTAL BRUTO</span>
                  <span>S/ {subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-[11px] font-black uppercase">
                  <span className="text-white/40">AJUSTE GLOBAL</span>
                  <input 
                    type="number" 
                    value={globalDiscount} 
                    onChange={e => setGlobalDiscount(e.target.value)}
                    className="w-20 h-8 bg-white/10 border-none text-white text-right font-black rounded-lg text-[10px]" 
                    placeholder="0.00"
                  />
                </div>
              </div>
              <Button 
                className="w-full h-14 bg-primary text-white hover:bg-primary/90 font-black text-sm rounded-xl active:scale-95 transition-all mt-4" 
                onClick={handleRegisterSale}
                disabled={saving || items.length === 0 || (!selectedCustomer && !customerQuery)}
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                CONFIRMAR VENTA
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
