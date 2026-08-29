
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
  where,
  getDocs
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

  // Sincronización con la lógica de Secciones 1, 2 y 3:
  // Solo clientes que NO están en logística hoy Y tienen actividad activa (cotizaciones o pagos no bloqueados)
  const activeCustomerSuggestions = React.useMemo(() => {
    // Clientes que ya están en algún lote de logística histórico o actual
    const shippedCustIds = new Set(historyBatches.flatMap(l => (l.entries || []).map((e: any) => e.customerId)))
    if (logData?.entries) {
      logData.entries.forEach((e: any) => shippedCustIds.add(e.customerId))
    }

    const activeQuoteCustIds = new Set(allQuotes.filter(q => q.status === 'active').map(q => q.customerId))
    const pendingPaymentCustIds = new Set(allPayments.filter(p => !p.isLocked).map(p => p.customerId))

    return dbCustomers.filter(c => {
      const isNotShipped = !shippedCustIds.has(c.id)
      const hasActivity = activeQuoteCustIds.has(c.id) || pendingPaymentCustIds.has(c.id)
      return isNotShipped && hasActivity
    })
  }, [dbCustomers, allQuotes, allPayments, historyBatches, logData])

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
    
    // Al añadir a logística, las boletas pasan a 'shipped'
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
    <div className="w-full max-w-4xl mx-auto pt-0 pb-24">
      <Tabs defaultValue="envios" className="w-full">
        <TabsList className="chrome-tab-list sticky top-[57px] z-[45]">
          <TabsTrigger value="clientes" className="chrome-tab-trigger">
            <Users className="w-3.5 h-3.5 mr-2 opacity-50" /> Clientes
          </TabsTrigger>
          <TabsTrigger value="envios" className="chrome-tab-trigger">
            <Truck className="w-3.5 h-3.5 mr-2 opacity-50" /> Envíos
          </TabsTrigger>
        </TabsList>

        <div className="px-2 md:px-0 mt-4">
          <TabsContent value="clientes" className="mt-0"><CustomersHubPage /></TabsContent>

          <TabsContent value="envios" className="mt-0 space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-3 border-b border-slate-300 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm bg-slate-900"><Truck className="w-5 h-5 text-white" /></div>
                <h1 className="text-xl font-headline font-normal text-foreground uppercase tracking-tight">LOGÍSTICA</h1>
              </div>
              <div className="flex items-center justify-between w-full md:w-auto gap-6">
                <div className="text-right flex flex-col items-end">
                  <span className="text-[8px] font-bold text-primary/60 uppercase tracking-[0.2em]">SUBTOTAL LOTE</span>
                  <div className="flex items-end gap-1">
                    <span className="text-[10px] font-bold text-primary mb-0.5">S/</span>
                    <span className="text-2xl font-headline font-black text-foreground leading-none">{batchTotal.toFixed(1)}</span>
                  </div>
                </div>
                <input 
                  type="date" 
                  value={dateKey} 
                  onChange={(e) => { if (e.target.value) setDate(new Date(e.target.value + "T12:00:00")); }} 
                  className="h-10 px-3 rounded-xl border border-slate-300 font-medium text-[11px] uppercase bg-white focus:outline-none focus:ring-1 focus:ring-primary/20 shadow-sm" 
                />
              </div>
            </div>

            <div className="relative w-full z-[40]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
              <Input 
                placeholder="AÑADIR CLIENTE (SOLO SECC. 1, 2 Y 3)..." 
                className="pl-11 h-11 w-full rounded-xl border border-slate-300 font-medium text-xs uppercase shadow-sm bg-white" 
                value={customerSearch} 
                onChange={e => setCustomerSearch(e.target.value)} 
                onFocus={() => setIsSearchOpen(true)} 
              />
              {isSearchOpen && (
                <div className="absolute z-[50] w-full mt-1 bg-white border border-slate-300 rounded-xl shadow-2xl overflow-hidden">
                  <div className="p-2 bg-slate-50 border-b border-slate-200 flex justify-between items-center px-4">
                    <span className="text-[8px] font-bold uppercase text-slate-500 tracking-widest">Clientes en Ciclo Activo</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsSearchOpen(false)}><X className="w-3.5 h-3.5" /></Button>
                  </div>
                  <div className="max-h-[250px] overflow-y-auto">
                    {filteredSuggestions.length === 0 ? (
                      <div className="p-10 text-center opacity-20 text-[9px] font-bold uppercase">Sin clientes pendientes de envío</div>
                    ) : filteredSuggestions.map(c => (
                      <button key={c.id} className="w-full text-left px-5 py-4 hover:bg-slate-50 border-b last:border-0 flex items-center justify-between group" onClick={() => handleAddCustomer(c)}>
                        <div className="flex flex-col">
                          <span className="font-medium text-[11px] uppercase group-hover:text-primary transition-colors text-slate-700">{c.name}</span>
                          <span className="text-[8px] font-bold text-slate-400 uppercase">{c.id}</span>
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
                    <AccordionItem value={entry.customerId} className="border border-slate-300 rounded-xl overflow-hidden bg-white shadow-sm">
                      <AccordionTrigger className="w-full hover:no-underline py-2.5 px-4 h-14 transition-colors hover:bg-slate-50/50">
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-4 text-left min-w-0 flex-1">
                            <span className="w-7 h-7 rounded-lg bg-slate-50 text-slate-400 flex items-center justify-center font-bold text-[11px] shrink-0 border border-slate-200">{index + 1}</span>
                            <div className="flex flex-col truncate">
                              <span className="font-medium text-[13px] uppercase text-slate-800 leading-none truncate">{entry.customerName}</span>
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{entry.customerId}</span>
                            </div>
                          </div>
                          <div className={cn("px-3 py-1 rounded-md font-black text-[12px] text-white ml-auto mr-4 shrink-0 shadow-sm", balance < -0.1 ? "bg-red-600" : balance > 0.1 ? "bg-blue-600" : "bg-[#10b981]")}>
                            {Math.abs(balance).toFixed(1)}
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pb-4 pt-2 px-4 border-t border-slate-100 bg-slate-50/30">
                        <div className="space-y-4 pt-2">
                          <div className="flex items-center justify-between h-10 bg-white px-4 rounded-xl border border-slate-300 shadow-sm">
                            <div className="flex items-center gap-4 flex-1">
                              <Label className="text-[9px] font-bold text-slate-500 uppercase shrink-0 tracking-widest">COSTO ENVÍO</Label>
                              <div className="relative flex-1 max-w-[120px]">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-[9px] text-slate-400">S/</span>
                                <Input 
                                  type="number" 
                                  value={entry.shippingCost || ""} 
                                  onChange={e => handleUpdateShippingCost(entry.customerId, e.target.value)} 
                                  className="h-7 pl-8 text-[11px] font-bold bg-slate-50 border-none w-full text-center rounded-lg" 
                                />
                              </div>
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50 rounded-lg" onClick={() => setDeleteConfirm({ id: entry.customerId, name: entry.customerName })}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                          
                          <div className="space-y-1.5">
                            <div className="px-1 mb-2 border-b border-slate-200 pb-1"><span className="text-[9px] font-bold uppercase text-slate-400 tracking-widest">BOLETAS</span></div>
                            {(entry.quotes || []).map((q: any) => (
                              <div key={q.quoteId} className="flex items-center justify-between h-9 px-4 rounded-xl border bg-white border-slate-200 shadow-sm group">
                                <span className="text-[11px] font-medium uppercase truncate flex-1 text-slate-700">{q.quoteId} | <span className="text-slate-400">{q.qty} UND</span></span>
                                <div className="flex items-center gap-4">
                                  <span className="text-[11px] font-bold text-slate-900">S/ {Number(q.amount).toFixed(1)}</span>
                                  <button onClick={() => handleRemoveItemFromEntry(entry.customerId, q.quoteId, 'quote')} className="text-slate-300 hover:text-red-500 transition-colors"><X className="w-4 h-4" /></button>
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="space-y-1.5">
                            <div className="px-1 mb-2 border-b border-slate-200 pb-1"><span className="text-[9px] font-bold uppercase text-slate-400 tracking-widest">PAGOS</span></div>
                            {(entry.payments || []).map((p: any) => (
                              <div key={p.paymentId} className="flex items-center justify-between h-9 px-4 rounded-xl border bg-emerald-50/50 border-emerald-100 shadow-sm group">
                                <span className="text-[11px] font-medium text-emerald-700 flex-1">ID: PAGO</span>
                                <div className="flex items-center gap-4">
                                  <span className="text-[11px] font-bold text-emerald-800">S/ {Number(p.amount).toFixed(1)}</span>
                                  <button onClick={() => handleRemoveItemFromEntry(entry.customerId, p.paymentId, 'payment')} className="text-slate-300 hover:text-red-500 transition-colors"><X className="w-4 h-4" /></button>
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
          </TabsContent>
        </div>
      </Tabs>
      
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="rounded-3xl max-w-[300px] p-8 text-center border-none shadow-2xl">
          <DialogHeader className="sr-only"><DialogTitle>Confirmar Acción</DialogTitle></DialogHeader>
          <div className="flex flex-col items-center gap-6">
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
              <Trash2 className="w-8 h-8 text-red-500" />
            </div>
            <p className="text-[12px] font-medium uppercase text-slate-800 leading-relaxed">
              ¿REMOVER A <span className="text-red-600 font-bold">{deleteConfirm?.name}</span> DEL LOTE?<br/>
              <span className="text-[10px] text-slate-400 mt-2 block">(Las boletas volverán a estado ACTIVO)</span>
            </p>
            <div className="grid grid-cols-2 gap-4 w-full">
              <Button variant="outline" className="h-12 rounded-xl font-bold text-[11px] uppercase border-slate-200" onClick={() => setDeleteConfirm(null)}>CANCELAR</Button>
              <Button className="h-12 bg-red-600 text-white rounded-xl font-bold text-[11px] uppercase shadow-lg shadow-red-200" onClick={handleRemoveEntry}>CONFIRMAR</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
