
"use client"

import * as React from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Users, 
  Truck, 
  Search, 
  Plus, 
  Trash2, 
  X,
  History,
  Edit2,
  ChevronDown
} from "lucide-react"
import { format, subDays } from "date-fns"
import { es } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import { useFirestore, useDoc, useCollection } from "@/firebase"
import { 
  doc, 
  setDoc, 
  serverTimestamp, 
  query, 
  collection, 
  orderBy, 
  updateDoc,
  where
} from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import CustomersHubPage from "../customers/page"

export default function ShippingHubPage() {
  const db = useFirestore()
  const { toast } = useToast()
  
  const [date, setDate] = React.useState<Date>(new Date())
  const [customerSearch, setCustomerSearch] = React.useState("")
  const [isSearchOpen, setIsSearchOpen] = React.useState(false)
  const [deleteConfirm, setDeleteConfirm] = React.useState<{id: string, name: string} | null>(null)
  const [historyDays, setHistoryDays] = React.useState(15)

  const dateKey = format(date, "yyyy-MM-dd")
  const logisticsDocRef = React.useMemo(() => db ? doc(db, "logistics", dateKey) : null, [db, dateKey])
  const { data: logData } = useDoc(logisticsDocRef)
  
  const allLogisticsRef = React.useMemo(() => {
    if (!db) return null
    const startRange = format(subDays(new Date(), historyDays), "yyyy-MM-dd")
    return query(
      collection(db, "logistics"), 
      where("date", ">=", startRange),
      orderBy("date", "desc")
    )
  }, [db, historyDays])
  
  const { data: historyBatches = [] } = useCollection(allLogisticsRef)

  const customersRef = React.useMemo(() => db ? query(collection(db, "customers"), orderBy("name")) : null, [db])
  const { data: dbCustomers = [] } = useCollection(customersRef)
  
  const allQuotesRef = React.useMemo(() => db ? collection(db, "quotes") : null, [db])
  const allPaymentsRef = React.useMemo(() => db ? collection(db, "payments") : null, [db])
  const { data: allQuotes = [] } = useCollection(allQuotesRef)
  const { data: allPayments = [] } = useCollection(allPaymentsRef)

  const activeCustomerSuggestions = React.useMemo(() => {
    const activeCustIds = new Set(allQuotes.filter(q => q.status === 'active').map(q => q.customerId))
    const paymentCustIds = new Set(allPayments.filter(p => !p.isLocked).map(p => p.customerId))
    return dbCustomers.filter(c => activeCustIds.has(c.id) || paymentCustIds.has(c.id))
  }, [dbCustomers, allQuotes, allPayments])

  const filteredSuggestions = React.useMemo(() => {
    const q = customerSearch.toLowerCase()
    return activeCustomerSuggestions.filter(c => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q))
  }, [activeCustomerSuggestions, customerSearch])

  const calculateEntryBalance = (entry: any) => {
    const shipping = Number(entry.shippingCost || 0)
    const quotesTotal = (entry.quotes || []).reduce((acc: number, q: any) => acc + Number(q.amount), 0)
    const paymentsTotal = (entry.payments || []).reduce((acc: number, p: any) => acc + Number(p.amount), 0)
    return paymentsTotal - (quotesTotal + shipping)
  }

  const batchTotal = React.useMemo(() => {
    return (logData?.entries || []).reduce((acc: number, entry: any) => acc + calculateEntryBalance(entry), 0)
  }, [logData])

  const handleAddCustomer = async (customer: any) => {
    if (!db || !logisticsDocRef) return
    
    const customerQuotes = allQuotes.filter(q => q.customerId === customer.id && q.status === "active")
    const customerPayments = allPayments.filter(p => p.customerId === customer.id && !p.isLocked)
    
    if (customerQuotes.length === 0 && customerPayments.length === 0) {
      toast({ title: "SIN PENDIENTES", description: "No hay boletas activas ni pagos para este cliente." })
      return
    }

    for (const q of customerQuotes) {
      updateDoc(doc(db, "quotes", q.id), { status: 'shipped' }).catch(() => {})
    }

    const newEntry = {
      customerId: customer.id,
      customerName: customer.name,
      addedAt: new Date().toISOString(),
      shippingCost: 0,
      quotes: customerQuotes.map(q => ({ quoteId: q.id, amount: q.total, qty: (q.items || []).reduce((acc: number, i: any) => acc + Number(i.quantity), 0) })),
      payments: customerPayments.map(p => ({ paymentId: p.id, amount: p.amount }))
    }

    const currentEntries = logData?.entries || []
    if (currentEntries.some((e: any) => e.customerId === customer.id)) return
    
    await setDoc(logisticsDocRef, { date: dateKey, entries: [...currentEntries, newEntry], updatedAt: serverTimestamp() }, { merge: true })
    
    setCustomerSearch("")
    setIsSearchOpen(false)
    toast({ title: "CLIENTE AÑADIDO" })
  }

  const handleUpdateShippingCost = async (customerId: string, cost: string) => {
    if (!logisticsDocRef || !logData) return
    const val = Number(cost)
    const updatedEntries = logData.entries.map((e: any) => e.customerId === customerId ? { ...e, shippingCost: isNaN(val) ? 0 : val } : e)
    await updateDoc(logisticsDocRef, { entries: updatedEntries, updatedAt: serverTimestamp() })
  }

  const handleRemoveItemFromEntry = async (customerId: string, itemId: string, type: 'quote' | 'payment') => {
    if (!db || !logisticsDocRef || !logData) return
    
    if (type === 'quote') {
      updateDoc(doc(db, "quotes", itemId), { status: 'active' }).catch(() => {})
    }

    const updatedEntries = logData.entries.map((entry: any) => {
      if (entry.customerId === customerId) {
        if (type === 'quote') return { ...entry, quotes: entry.quotes.filter((q: any) => q.quoteId !== itemId) }
        return { ...entry, payments: entry.payments.filter((p: any) => p.paymentId !== itemId) }
      }
      return entry
    })
    await updateDoc(logisticsDocRef, { entries: updatedEntries, updatedAt: serverTimestamp() })
  }

  const handleRemoveEntry = async () => {
    if (!db || !logisticsDocRef || !logData || !deleteConfirm) return
    
    const entryToRemove = logData.entries.find((e: any) => e.customerId === deleteConfirm.id)
    if (entryToRemove && entryToRemove.quotes) {
      for (const q of entryToRemove.quotes) {
        updateDoc(doc(db, "quotes", q.quoteId), { status: 'active' }).catch(() => {})
      }
    }

    const updatedEntries = logData.entries.filter((e: any) => e.customerId !== deleteConfirm.id)
    await updateDoc(logisticsDocRef, { entries: updatedEntries, updatedAt: serverTimestamp() })
    setDeleteConfirm(null)
  }

  return (
    <div className="w-full max-w-4xl mx-auto pt-1 pb-24 px-2 md:px-0">
      <Tabs defaultValue="envios" className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-12 bg-white border-b border-primary/10 rounded-none mb-4 sticky top-0 z-50 shadow-sm p-1">
          <TabsTrigger value="clientes" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white font-black text-[11px] uppercase transition-all flex items-center gap-2">
            <Users className="w-3.5 h-3.5" /> Clientes
          </TabsTrigger>
          <TabsTrigger value="envios" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white font-black text-[11px] uppercase transition-all flex items-center gap-2">
            <Truck className="w-3.5 h-3.5" /> Envíos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="clientes" className="mt-0"><CustomersHubPage /></TabsContent>

        <TabsContent value="envios" className="mt-0 space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-3 border-b-2 border-black pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg bg-primary"><Truck className="w-5 h-5 text-white" /></div>
              <h1 className="text-xl font-headline font-black text-foreground uppercase tracking-tight">LOGÍSTICA</h1>
            </div>
            <div className="flex items-center justify-between w-full md:w-auto gap-6">
              <div className="text-right flex flex-col items-end">
                <span className="text-[8px] font-black text-primary/40 uppercase tracking-widest">SUBTOTAL LOTE</span>
                <div className="flex items-end gap-1">
                  <span className="text-[10px] font-black text-primary mb-0.5">S/</span>
                  <span className="text-2xl font-headline font-black text-foreground leading-none">{batchTotal.toFixed(1)}</span>
                </div>
              </div>
              <input 
                type="date" 
                value={dateKey} 
                onChange={(e) => { if (e.target.value) setDate(new Date(e.target.value + "T12:00:00")); }} 
                className="h-10 px-3 rounded-xl border-2 border-primary/10 font-black text-[11px] uppercase bg-white focus:outline-none focus:border-primary shadow-sm" 
              />
            </div>
          </div>

          <div className="relative w-full z-[100]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/40" />
            <Input 
              placeholder="AÑADIR CLIENTE PENDIENTE..." 
              className="pl-11 h-11 w-full rounded-xl border-2 border-primary/10 font-black text-xs uppercase shadow-sm bg-white" 
              value={customerSearch} 
              onChange={e => setCustomerSearch(e.target.value)} 
              onFocus={() => setIsSearchOpen(true)} 
            />
            {isSearchOpen && (
              <div className="absolute z-[9999] w-full mt-1 bg-white border-2 border-primary/10 rounded-xl shadow-2xl overflow-hidden">
                <div className="p-2 bg-primary/5 border-b border-primary/5 flex justify-between items-center px-4">
                  <span className="text-[8px] font-black uppercase text-primary tracking-widest">Resultados</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsSearchOpen(false)}><X className="w-3.5 h-3.5" /></Button>
                </div>
                <div className="max-h-[250px] overflow-y-auto">
                  {filteredSuggestions.length === 0 ? (
                    <div className="p-10 text-center opacity-20 text-[9px] font-black uppercase">Sin boletas activas</div>
                  ) : filteredSuggestions.map(c => (
                    <button key={c.id} className="w-full text-left px-5 py-4 hover:bg-primary/5 border-b last:border-0 flex items-center justify-between group" onClick={() => handleAddCustomer(c)}>
                      <div className="flex flex-col">
                        <span className="font-black text-[11px] uppercase group-hover:text-primary transition-colors">{c.name}</span>
                        <span className="text-[8px] font-bold text-primary/40 uppercase">{c.id}</span>
                      </div>
                      <Plus className="w-4 h-4 text-primary" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            {(logData?.entries || []).sort((a: any, b: any) => new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime()).map((entry: any, index: number) => {
              const balance = calculateEntryBalance(entry)
              return (
                <Accordion key={entry.customerId} type="single" collapsible className="w-full">
                  <AccordionItem value={entry.customerId} className="border-2 border-primary/10 rounded-xl overflow-hidden bg-white shadow-sm">
                    <AccordionTrigger className="w-full hover:no-underline py-2.5 px-4 h-14 transition-colors hover:bg-black/[0.01]">
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-4 text-left min-w-0 flex-1">
                          <span className="w-7 h-7 rounded-lg bg-primary/5 text-primary flex items-center justify-center font-black text-[11px] shrink-0 border border-primary/10">{index + 1}</span>
                          <div className="flex flex-col truncate">
                            <span className="font-black text-[13px] uppercase text-black leading-none truncate">{entry.customerName}</span>
                            <span className="text-[9px] font-bold text-primary/40 uppercase tracking-widest mt-0.5">{entry.customerId}</span>
                          </div>
                        </div>
                        <div className={cn("px-3 py-1 rounded-md font-black text-[12px] text-white ml-auto mr-4 shrink-0 shadow-sm", balance < -0.1 ? "bg-red-600" : balance > 0.1 ? "bg-blue-600" : "bg-green-600")}>
                          {Math.abs(balance).toFixed(1)}
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-4 pt-2 px-4 border-t border-primary/5 bg-primary/[0.01]">
                      <div className="space-y-4 pt-2">
                        <div className="flex items-center justify-between h-10 bg-white px-4 rounded-xl border-2 border-primary/10 shadow-sm">
                          <div className="flex items-center gap-4 flex-1">
                            <Label className="text-[9px] font-black text-primary uppercase shrink-0 tracking-widest">COSTO ENVÍO</Label>
                            <div className="relative flex-1 max-w-[120px]">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-[9px] text-primary/40">S/</span>
                              <Input 
                                type="number" 
                                value={entry.shippingCost || ""} 
                                onChange={e => handleUpdateShippingCost(entry.customerId, e.target.value)} 
                                className="h-7 pl-8 text-[11px] font-black bg-primary/5 border-none w-full text-center rounded-lg" 
                              />
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50 rounded-lg" onClick={() => setDeleteConfirm({ id: entry.customerId, name: entry.customerName })}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        
                        <div className="space-y-1.5">
                          <div className="px-1 mb-2 border-b-2 border-primary/5 pb-1"><span className="text-[9px] font-black uppercase text-primary/60 tracking-widest">BOLETAS</span></div>
                          {(entry.quotes || []).map((q: any) => (
                            <div key={q.quoteId} className="flex items-center justify-between h-9 px-4 rounded-xl border bg-white border-primary/5 shadow-sm group">
                              <span className="text-[11px] font-black uppercase truncate flex-1">{q.quoteId} | <span className="text-primary/60">{q.qty} UND</span></span>
                              <div className="flex items-center gap-4">
                                <span className="text-[11px] font-black text-black">S/ {Number(q.amount).toFixed(1)}</span>
                                <button onClick={() => handleRemoveItemFromEntry(entry.customerId, q.quoteId, 'quote')} className="text-black/20 hover:text-red-500 transition-colors"><X className="w-4 h-4" /></button>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="space-y-1.5">
                          <div className="px-1 mb-2 border-b-2 border-primary/5 pb-1"><span className="text-[9px] font-black uppercase text-primary/60 tracking-widest">PAGOS</span></div>
                          {(entry.payments || []).map((p: any) => (
                            <div key={p.paymentId} className="flex items-center justify-between h-9 px-4 rounded-xl border bg-green-50/30 border-green-200/50 shadow-sm group">
                              <span className="text-[11px] font-black text-green-700 flex-1">ID: PAGO</span>
                              <div className="flex items-center gap-4">
                                <span className="text-[11px] font-black text-green-800">S/ {Number(p.amount).toFixed(1)}</span>
                                <button onClick={() => handleRemoveItemFromEntry(entry.customerId, p.paymentId, 'payment')} className="text-black/20 hover:text-red-500 transition-colors"><X className="w-4 h-4" /></button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              )
            })}
          </div>

          <div className="pt-8 space-y-4">
            <div className="flex items-center gap-3 border-b-2 border-black/10 pb-2 ml-1">
              <History className="w-4 h-4 text-black/40" />
              <h2 className="text-[11px] font-black uppercase tracking-widest text-black/60">Trazabilidad de Lotes</h2>
            </div>
            <div className="space-y-2">
              {historyBatches.map(batch => {
                let hDebt = false, isZero = true;
                (batch.entries || []).forEach((e: any) => { 
                  const b = calculateEntryBalance(e); 
                  if (b < -0.1) { hDebt = true; isZero = false; } 
                  else if (b > 0.1) isZero = false; 
                });
                return (
                  <Card key={batch.date} className="rounded-2xl border border-black/5 bg-white shadow-sm hover:shadow-md transition-all overflow-hidden">
                    <CardContent className="p-4 flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="text-[11px] font-black uppercase tracking-tight">{format(new Date(batch.date + "T12:00:00"), "EEEE d 'DE' MMMM", { locale: es }).toUpperCase()}</span>
                        <span className="text-[9px] font-black text-primary/40 uppercase tracking-widest mt-0.5">{batch.entries?.length || 0} CLIENTES DESPACHADOS</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge variant="outline" className={cn("text-[8px] font-black h-6 px-3 uppercase border-none rounded-lg shadow-inner", isZero ? "bg-slate-100 text-slate-500" : hDebt ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600")}>
                          {isZero ? "CUADRADO" : hDebt ? "DEUDA PENDIENTE" : "SALDO A FAVOR"}
                        </Badge>
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-primary hover:bg-primary/5 rounded-xl border border-primary/10" onClick={() => { setDate(new Date(batch.date + "T12:00:00")); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
            
            {historyBatches.length > 0 && (
              <div className="flex justify-center pt-4 pb-8">
                <Button 
                  variant="outline" 
                  className="h-10 rounded-xl border-primary/20 text-primary font-black uppercase text-[9px] px-8 bg-white shadow-sm"
                  onClick={() => setHistoryDays(prev => prev + 15)}
                >
                  <ChevronDown className="w-4 h-4 mr-2" /> Cargar 15 días anteriores
                </Button>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
      
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="rounded-[2.5rem] max-w-[300px] p-8 text-center border-none shadow-2xl">
          <DialogHeader className="sr-only"><DialogTitle>Confirmar Acción</DialogTitle></DialogHeader>
          <div className="flex flex-col items-center gap-6">
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
              <Trash2 className="w-8 h-8 text-red-500" />
            </div>
            <p className="text-[12px] font-black uppercase text-black leading-relaxed">
              ¿REMOVER A <span className="text-red-600">{deleteConfirm?.name}</span> DEL LOTE?<br/>
              <span className="text-[10px] text-muted-foreground mt-2 block">(Las boletas volverán a estado ACTIVO)</span>
            </p>
            <div className="grid grid-cols-2 gap-4 w-full">
              <Button variant="outline" className="h-12 rounded-xl font-black text-[11px] uppercase border-primary/10" onClick={() => setDeleteConfirm(null)}>CANCELAR</Button>
              <Button className="h-12 bg-red-600 text-white rounded-xl font-black text-[11px] uppercase shadow-lg shadow-red-200" onClick={handleRemoveEntry}>CONFIRMAR</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
