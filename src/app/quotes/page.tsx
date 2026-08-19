
"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { 
  Trash2, 
  Plus, 
  Search, 
  ShoppingCart, 
  Share2, 
  Save, 
  Printer, 
  Loader2, 
  UserPlus, 
  PackageSearch,
  CheckCircle2
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
  quantity: number | string
  price: number | string
  priceType: 'fardo' | 'mayor' | 'unidad' | 'custom'
  stock: number
  img: string
  discount: number | string
  isRegistered: boolean
}

export default function QuotesPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const [saving, setSaving] = React.useState(false)
  const [date, setDate] = React.useState("")
  const [time, setTime] = React.useState("")
  const [quoteId, setQuoteId] = React.useState("B-001")
  
  const [customerQuery, setCustomerQuery] = React.useState("")
  const [selectedCustomer, setSelectedCustomer] = React.useState<{id: string, name: string} | null>(null)

  const [productQuery, setProductQuery] = React.useState("")
  const [items, setItems] = React.useState<QuoteItem[]>([])
  const [globalDiscount, setGlobalDiscount] = React.useState<string | number>("")

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
    setDate(new Date().toISOString().split('T')[0])
    setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
    fetchNextQuoteId()
  }, [fetchNextQuoteId])

  // Filtrado de Clientes (Código Puro)
  const customerSuggestions = React.useMemo(() => {
    if (customerQuery.length < 2) return []
    const q = customerQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    return dbCustomers.filter(c => 
      c.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q) ||
      c.id.toLowerCase().includes(q)
    )
  }, [customerQuery, dbCustomers])

  // Filtrado de Productos (Código Puro)
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
      toast({ title: "CLIENTE REGISTRADO", description: `${newCustomer.name} ASIGNADO COMO ${nextId}` })
    } catch (e) {
      toast({ variant: "destructive", title: "ERROR", description: "FALLA AL REGISTRAR CLIENTE." })
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
      quantity: 1,
      price: prod.priceMayor || 0,
      priceType: 'mayor',
      stock: prod.stock || 0,
      img: prod.images?.[0] || "",
      discount: 0,
      isRegistered: true
    }])
    setProductQuery("")
  }

  const addUnregisteredItem = () => {
    setItems([...items, {
      id: Math.random().toString(),
      productId: "NR-" + Math.random().toString(36).substr(2, 5).toUpperCase(),
      name: productQuery.toUpperCase().trim() || "PRODUCTO SIN REGISTRO",
      description: "",
      quantity: 1,
      price: 0,
      priceType: 'custom',
      stock: 0,
      img: "",
      discount: 0,
      isRegistered: false
    }])
    setProductQuery("")
  }

  const updateItem = (id: string, updates: Partial<QuoteItem>) => {
    setItems(items.map(i => i.id === id ? { ...i, ...updates } : i))
  }

  const removeItem = (id: string) => {
    setItems(items.filter(i => i.id !== id))
  }

  const handleRegisterSale = async () => {
    if (!db || items.length === 0 || (!selectedCustomer && !customerQuery)) return
    
    const finalCustomerName = selectedCustomer?.name || customerQuery.toUpperCase().trim()
    
    setSaving(true)
    try {
      await setDoc(doc(db, "quotes", quoteId), {
        id: quoteId,
        customerName: finalCustomerName,
        customerId: selectedCustomer?.id || "GENERIC",
        items,
        subtotal: subtotal,
        discount: Number(globalDiscount || 0),
        total: finalTotal,
        status: 'active',
        createdAt: serverTimestamp()
      })

      // Actualizar Stock solo para productos registrados
      for (const item of items) {
        if (item.isRegistered) {
          const qty = Number(item.quantity)
          const pRef = doc(db, "products", item.productId)
          updateDoc(pRef, { stock: increment(-qty) })
          addDoc(collection(db, "movements"), {
            productCode: item.productId,
            type: "out",
            quantity: qty,
            reason: `VENTA SERIE ${quoteId}`,
            timestamp: serverTimestamp()
          })
        }
      }

      toast({ title: "VENTA REGISTRADA", description: `BOLETA ${quoteId} GUARDADA CON ÉXITO.` })
      setItems([])
      setSelectedCustomer(null)
      setCustomerQuery("")
      fetchNextQuoteId()
    } catch (e) {
      toast({ variant: "destructive", title: "ERROR", description: "FALLA CRÍTICA AL REGISTRAR VENTA." })
    } finally {
      setSaving(false)
    }
  }

  const subtotal = items.reduce((acc, item) => {
    const lineSub = Number(item.quantity || 0) * Number(item.price || 0)
    const lineDisc = Number(item.discount || 0)
    return acc + (lineSub - lineDisc)
  }, 0)
  
  const finalTotal = subtotal - Number(globalDiscount || 0)
  const totalQty = items.reduce((acc, item) => acc + Number(item.quantity || 0), 0)

  const getThumbnailUrl = (url: string) => {
    if (!url || typeof url !== 'string' || !url.startsWith('http')) return url;
    if (!url.includes('id=')) return url;
    const idMatch = url.match(/id=([^&]+)/);
    return idMatch ? `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=300` : url;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 pt-2">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-headline font-black text-black flex items-center gap-3 uppercase">
            COTIZACIÓN <span className="text-primary">{quoteId}</span>
          </h1>
          <Badge variant="outline" className="text-[9px] font-black border-black/20 uppercase tracking-[0.2em] px-3 mt-1">Industrial Edition</Badge>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" className="rounded-xl border-black text-black font-black" size="icon"><Printer className="w-4 h-4" /></Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="rounded-[2.5rem] border shadow-sm overflow-hidden bg-white">
            <CardHeader className="grid grid-cols-2 gap-4 pb-6 bg-black/5 border-b">
              <div className="space-y-1">
                <Label className="text-[9px] uppercase text-black font-black tracking-widest ml-1">Cliente</Label>
                <div className="relative group">
                  <Input 
                    placeholder="BUSCAR O ESCRIBIR NOMBRE..." 
                    className="h-10 text-sm font-black text-black uppercase rounded-xl border-black/10 pr-10"
                    value={selectedCustomer ? selectedCustomer.name : customerQuery}
                    onChange={e => {
                      if (selectedCustomer) setSelectedCustomer(null)
                      setCustomerQuery(e.target.value)
                    }}
                  />
                  {customerQuery.length >= 2 && !selectedCustomer && (
                    <button 
                      onClick={registerNewCustomer}
                      className="absolute right-2 top-2 h-6 w-6 bg-primary rounded-lg flex items-center justify-center text-white shadow-sm hover:scale-110 transition-all"
                      title="Registrar Nuevo Cliente"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {customerSuggestions.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border rounded-xl shadow-xl overflow-hidden">
                      {customerSuggestions.map(c => (
                        <button 
                          key={c.id} 
                          className="w-full text-left px-4 py-3 hover:bg-black/5 flex items-center justify-between border-b last:border-0"
                          onClick={() => {
                            setSelectedCustomer({ id: c.id, name: c.name })
                            setCustomerQuery("")
                          }}
                        >
                          <span className="text-[11px] font-black uppercase text-black">{c.name}</span>
                          <span className="text-[8px] opacity-40 font-black">{c.id}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[9px] uppercase text-black font-black tracking-widest ml-1">Fecha</Label>
                  <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-10 text-[10px] rounded-xl border-black/10 font-black" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] uppercase text-black font-black tracking-widest ml-1">Hora</Label>
                  <Input value={time} readOnly className="h-10 text-[10px] bg-black/5 rounded-xl border-none font-black" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-8 pt-8 px-8">
              <div className="relative space-y-2">
                <Label className="text-[9px] uppercase font-black text-black tracking-widest ml-1">Buscador de Prendas</Label>
                <div className="relative">
                  <Search className="absolute left-4 top-4 h-5 w-5 text-black/40" />
                  <Input 
                    placeholder="DNI O NOMBRE DE PRENDA..." 
                    className="pl-12 h-14 rounded-[1.25rem] border-black/10 font-black text-sm uppercase text-black"
                    value={productQuery}
                    onChange={e => setProductQuery(e.target.value)}
                  />
                  {productQuery.length >= 2 && (
                    <div className="absolute z-20 w-full mt-2 bg-white border border-black/10 rounded-[2rem] shadow-2xl overflow-hidden">
                      <div className="max-h-80 overflow-y-auto">
                        {productSuggestions.map(p => (
                          <button 
                            key={p.code} 
                            className="w-full text-left px-8 py-4 hover:bg-black/5 flex items-center justify-between border-b last:border-0 group"
                            onClick={() => addItem(p)}
                          >
                            <div className="flex items-center gap-5">
                              <div className="w-14 h-14 rounded-xl overflow-hidden border bg-muted shrink-0">
                                {p.images?.[0] ? (
                                  <img src={getThumbnailUrl(p.images[0])} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                  <PackageSearch className="w-full h-full p-3 opacity-20" />
                                )}
                              </div>
                              <div>
                                <div className="font-black text-sm text-black uppercase leading-none">{p.name}</div>
                                <div className="flex gap-2 mt-1.5">
                                  <span className="text-[7px] bg-black text-white px-1.5 py-0.5 rounded-full font-black uppercase tracking-tighter">{p.code}</span>
                                  <span className="text-[7px] border border-black/20 text-black/60 px-1.5 py-0.5 rounded-full font-black uppercase tracking-tighter">{p.category}</span>
                                  <span className="text-[7px] border border-black/20 text-black/60 px-1.5 py-0.5 rounded-full font-black uppercase tracking-tighter">{p.collection}</span>
                                </div>
                                <div className="text-[8px] text-black/40 uppercase font-black mt-1">STOCK DISPONIBLE: {p.stock}</div>
                              </div>
                            </div>
                            <Plus className="w-5 h-5 text-black/20 group-hover:text-primary" />
                          </button>
                        ))}
                        <button 
                          className="w-full px-8 py-5 bg-primary/5 hover:bg-primary/10 text-primary font-black text-[10px] uppercase flex items-center justify-center gap-2"
                          onClick={addUnregisteredItem}
                        >
                          <Plus className="w-4 h-4" /> Registrar Prenda No Inventariada
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                {items.map(item => (
                  <div key={item.id} className="p-5 rounded-[2rem] border-2 border-black/5 bg-white transition-all hover:border-black/10">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                      <div className="md:col-span-2">
                        <div className="aspect-square rounded-2xl overflow-hidden bg-muted border border-black/5">
                           {item.img ? (
                             <img src={getThumbnailUrl(item.img)} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                           ) : (
                             <PackageSearch className="w-full h-full p-4 opacity-10" />
                           )}
                        </div>
                      </div>
                      <div className="md:col-span-10 flex flex-col justify-between">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-black text-base text-black uppercase flex items-center gap-2">
                              {item.name}
                              {!item.isRegistered && <Badge variant="secondary" className="text-[7px] h-4">NO INV</Badge>}
                            </div>
                            <div className="text-[9px] text-black/40 font-black uppercase tracking-widest mt-0.5">DNI: {item.productId}</div>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-destructive hover:bg-destructive/10 -mt-2 -mr-2"
                            onClick={() => removeItem(item.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                           <div className="space-y-1">
                             <Label className="text-[8px] font-black uppercase text-black/40 ml-1">Observaciones / Descripción</Label>
                             <Input 
                               value={item.description}
                               onChange={e => updateItem(item.id, { description: e.target.value })}
                               placeholder="TALLE, COLOR, MARCA..."
                               className="h-9 text-[10px] font-black uppercase rounded-xl border-black/10 bg-black/5 text-black"
                             />
                           </div>
                           <div className="md:col-span-2 flex items-center gap-3">
                              <div className="flex-1 space-y-1">
                                <Label className="text-[8px] font-black uppercase text-black/40 ml-1">Tarifa Diva</Label>
                                <Select 
                                  disabled={!item.isRegistered}
                                  value={item.priceType} 
                                  onValueChange={(v: any) => {
                                    const prod = dbProducts.find(p => p.code === item.productId)
                                    let newP = item.price
                                    if (v === 'fardo') newP = prod?.priceFardo
                                    if (v === 'mayor') newP = prod?.priceMayor
                                    if (v === 'unidad') newP = prod?.priceUnidad
                                    updateItem(item.id, { priceType: v, price: newP })
                                  }}
                                >
                                  <SelectTrigger className="h-9 rounded-xl border-black/10 bg-white font-black text-[9px] text-black uppercase">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="fardo" className="text-[9px] font-black">FARDO</SelectItem>
                                    <SelectItem value="mayor" className="text-[9px] font-black">MAYOR</SelectItem>
                                    <SelectItem value="unidad" className="text-[9px] font-black">UNIDAD</SelectItem>
                                    <SelectItem value="custom" className="text-[9px] font-black">PERSONAL</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="w-20 space-y-1">
                                <Label className="text-[8px] font-black uppercase text-black/40 ml-1">P. Unit</Label>
                                <Input 
                                  type="number" 
                                  value={item.price} 
                                  onChange={e => updateItem(item.id, { price: e.target.value, priceType: 'custom' })}
                                  className="h-9 font-black text-xs text-center border-black/10 rounded-xl text-black"
                                />
                              </div>
                              <div className="w-16 space-y-1">
                                <Label className="text-[8px] font-black uppercase text-black/40 ml-1">Cant</Label>
                                <Input 
                                  type="number" 
                                  value={item.quantity} 
                                  onChange={e => updateItem(item.id, { quantity: e.target.value })}
                                  className="h-9 font-black text-xs text-center border-primary/20 rounded-xl text-primary bg-primary/5"
                                />
                              </div>
                              <div className="w-20 space-y-1">
                                <Label className="text-[8px] font-black uppercase text-black/40 ml-1">Desc. Item</Label>
                                <Input 
                                  type="number" 
                                  value={item.discount} 
                                  onChange={e => updateItem(item.id, { discount: e.target.value })}
                                  className="h-9 font-black text-xs text-center border-orange-200 rounded-xl text-orange-600 bg-orange-50"
                                  placeholder="0"
                                />
                              </div>
                           </div>
                        </div>
                        
                        <div className="flex items-center justify-end pt-3 border-t border-black/5 mt-4 gap-4">
                           <div className="text-[9px] font-black uppercase text-black/40">Parcial Diva:</div>
                           <div className="text-[20px] font-black text-black">S/ {((Number(item.price || 0) * Number(item.quantity || 0)) - Number(item.discount || 0)).toFixed(2)}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {items.length === 0 && (
                  <div className="py-24 text-center border-2 border-dashed rounded-[3rem] border-black/10 text-black/20 flex flex-col items-center gap-4">
                    <ShoppingCart className="w-12 h-12 opacity-10" />
                    <span className="font-black text-[10px] uppercase tracking-widest">Sin prendas en proforma</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-black text-white border-none shadow-2xl rounded-[3rem] overflow-hidden">
            <CardHeader className="pb-4 pt-10 px-10">
              <CardTitle className="text-white/40 uppercase text-[9px] font-black tracking-[0.5em]">Cierre de Venta Pro</CardTitle>
            </CardHeader>
            <CardContent className="space-y-8 pt-4 px-10">
              <div className="flex justify-between items-end border-b border-white/10 pb-8">
                <div>
                  <div className="text-[9px] uppercase font-black text-white/40">Items</div>
                  <div className="font-headline font-black text-5xl tracking-tighter">{totalQty}</div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] uppercase font-black text-white/40">Neto S/</div>
                  <div className="font-headline font-black text-6xl tracking-tighter">{finalTotal.toFixed(2)}</div>
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <div className="flex justify-between items-center">
                  <span className="text-white/40 font-black uppercase text-[9px]">Subtotal Bruto</span>
                  <span className="font-black text-lg">S/ {subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white/40 font-black uppercase text-[9px]">Ajuste Global</span>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-[10px] text-white/40 font-black">S/</span>
                    <input 
                      type="number" 
                      value={globalDiscount} 
                      onChange={e => setGlobalDiscount(e.target.value)}
                      className="w-28 h-10 pl-7 text-base bg-white/10 border-none text-white text-right font-black rounded-xl focus:ring-1 focus:ring-white/40" 
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3 pt-6 pb-10 px-10">
              <Button 
                className="w-full h-16 bg-primary text-white hover:bg-primary/90 font-black text-base rounded-2xl shadow-xl active:scale-95 transition-all" 
                onClick={handleRegisterSale}
                disabled={saving || items.length === 0 || (!selectedCustomer && !customerQuery)}
              >
                {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-5 h-5 mr-3" />}
                CONFIRMAR VENTA
              </Button>
              <Button className="w-full h-12 bg-white/5 text-white hover:bg-white/10 border border-white/10 font-black rounded-2xl text-[9px] uppercase tracking-widest">
                <Printer className="w-4 h-4 mr-2" />
                IMPRIMIR TICKET
              </Button>
            </CardFooter>
          </Card>
          
          <Card className="rounded-[2.5rem] border shadow-sm bg-white overflow-hidden">
            <CardHeader className="bg-black/5 py-4 px-8 border-b">
              <CardTitle className="text-[9px] font-black uppercase text-black tracking-[0.4em]">Datos de Logística</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <Textarea 
                placeholder="AGENCIA DE ENVÍO, MÉTODO DE PAGO, OBSERVACIONES..." 
                className="text-[10px] bg-black/5 border-none rounded-[1.5rem] min-h-[120px] font-black text-black p-5 uppercase leading-relaxed" 
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
