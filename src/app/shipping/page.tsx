
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
  ChevronRight,
  MoreVertical,
  CalendarDays,
  UserPlus,
  AlertCircle,
  FileText,
  CreditCard,
  ArrowRight
} from "lucide-react"
import { format } from "date-fns"
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
  limit,
  getDoc
} from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import CustomersHubPage from "../customers/page"

export default function ShippingHubPage() {
  const db = useFirestore()
  const { toast } = useToast()
  
  const [date, setDate] = React.useState<Date>(new Date())
  const [customerSearch, setCustomerSearch] = React.useState("")
  const [isSearchFocused, setIsSearchFocused] = React.useState(false)
  const [deleteConfirm, setDeleteConfirm] = React.useState<{id: string, name: string} | null>(null)

  const dateKey = format(date, "yyyy-MM-dd")
  const logisticsDocRef = React.useMemo(() => db ? doc(db, "logistics", dateKey) : null, [db, dateKey])
  const { data: logData } = useDoc(logisticsDocRef)
  
  const historyRef = React.useMemo(() => db ? query(collection(db, "logistics"), orderBy("date", "desc"), limit(20)) : null, [db])
  const { data: historyBatches = [] } = useCollection(historyRef)

  const customersRef = React.useMemo(() => db ? query(collection(db, "customers"), orderBy("name")) : null, [db])
  const { data: dbCustomers = [] } = useCollection(customersRef)
  
  const allQuotesRef = React.useMemo(() => db ? collection(db, "quotes") : null, [db])
  const allPaymentsRef = React.useMemo(() => db ? collection(db, "payments") : null, [db])
  const { data: allQuotes = [] } = useCollection(allQuotesRef)
  const { data: allPayments = [] } = useCollection(allPaymentsRef)

  const activeCustomerSuggestions = React.useMemo(() => {
    const shippedInTodayBatch = new Set((logData?.entries || []).map((e: any) => e.customerId))
    // Nota: Un cliente puede estar en otros lotes pasados, pero si tiene boletas activas puede volver a aparecer
    const activeQuoteCustIds = new Set(allQuotes.filter(q => q.status === 'active').map(q => q.customerId))
    
    // Verificamos qué pagos no están en NINGÚN lote de logística
    const allProcessedPaymentIds = new Set(historyBatches.flatMap(b => (b.entries || []).flatMap((e: any) => (e.payments || []).map((p: any) => p.paymentId))))
    const pendingPaymentCustIds = new Set(allPayments.filter(p => !p.isLocked && !allProcessedPaymentIds.has(p.id)).map(p => p.customerId))

    return dbCustomers.filter(c => {
      const isNotAlreadyInToday = !shippedInTodayBatch.has(c.id)
      const hasActivity = activeQuoteCustIds.has(c.id) || pendingPaymentCustIds.has(c.id)
      return isNotAlreadyInToday && hasActivity
    })
  }, [dbCustomers, allQuotes, allPayments, historyBatches, logData])

  const filteredSuggestions = React.useMemo(() => {
    const q = customerSearch.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    if (!q) return activeCustomerSuggestions
    return activeCustomerSuggestions.filter(c => 
      c.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q) || 
      c.id.toLowerCase().includes(q)
    )
  }, [activeCustomerSuggestions, customerSearch])

  const stats = React.useMemo(() => {
    const entries = logData?.entries || []
    let facturado = 0
    let deuda = 0
    let favor = 0

    entries.forEach((e: any) => {
      const qTotal = (e.quotes || []).reduce((acc: number, q: any) => acc + Number(q.amount || 0), 0)
      const pTotal = (e.payments || []).reduce((acc: number, p: any) => acc + Number(p.amount || 0), 0)
      const ship = Number(e.shippingCost || 0)
      const bal = pTotal - (qTotal + ship)
      
      facturado += qTotal
      if (bal < -0.1) deuda += Math.abs(bal)
      if (bal > 0.1) favor += bal
    })

    return { facturado, deuda, favor }
  }, [logData])

  const handleAddCustomer = async (customer: any) => {
    if (!db || !logisticsDocRef) return
    
    // Capturar TODO lo activo al momento del registro inicial (Ley de Cierre)
    const customerQuotes = allQuotes
      .filter(q => q.customerId === customer.id && q.status === "active")
      .sort((a, b) => (a.date || "").localeCompare(b.date || "")) // Ordenar por fecha (antiguo arriba)

    // Pagos no procesados en ningún lote
    const allProcessedPaymentIds = new Set(historyBatches.flatMap(b => (b.entries || []).flatMap((e: any) => (e.payments || []).map((p: any) => p.paymentId))))
    const customerPayments = allPayments
      .filter(p => p.customerId === customer.id && !p.isLocked && !allProcessedPaymentIds.has(p.id))
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""))

    for (const q of customerQuotes) {
      updateDoc(doc(db, "quotes", q.id), { status: 'shipped' }).catch(() => {})
    }

    const newEntry = {
      customerId: customer.id,
      customerName: customer.name,
      addedAt: new Date().toISOString(),
      shippingCost: 0,
      quotes: customerQuotes.map(q => ({ quoteId: q.id, amount: q.total, date: q.date || "", qty: (q.items || []).reduce((acc: number, i: any) => acc + Number(i.quantity), 0) })),
      payments: customerPayments.map(p => ({ paymentId: p.id, amount: p.amount, date: p.date || "", bank: p.bankName }))
    }

    const currentEntries = logData?.entries || []
    await setDoc(logisticsDocRef, { 
      date: dateKey, 
      entries: [...currentEntries, newEntry], 
      updatedAt: serverTimestamp() 
    }, { merge: true })
    
    setCustomerSearch("")
    setIsSearchFocused(false)
    toast({ title: "CLIENTE AÑADIDO AL LOTE" })
  }

  const handleUnlinkQuote = async (customerId: string, quoteId: string) => {
    if (!db || !logisticsDocRef || !logData) return
    
    const entry = logData.entries.find((e: any) => e.customerId === customerId)
    if (!entry) return

    // Cambiar estado a activo en Firestore
    updateDoc(doc(db, "quotes", quoteId), { status: 'active' }).catch(() => {})

    const updatedEntries = logData.entries.map((e: any) => {
      if (e.customerId === customerId) {
        return { ...e, quotes: e.quotes.filter((q: any) => q.quoteId !== quoteId) }
      }
      return e
    })

    await updateDoc(logisticsDocRef, { entries: updatedEntries, updatedAt: serverTimestamp() })
    toast({ title: "BOLETA DESVINCULADA" })
  }

  const handleLinkQuote = async (customerId: string, quote: any) => {
    if (!db || !logisticsDocRef || !logData) return

    updateDoc(doc(db, "quotes", quote.id), { status: 'shipped' }).catch(() => {})

    const updatedEntries = logData.entries.map((e: any) => {
      if (e.customerId === customerId) {
        const newQuote = { 
          quoteId: quote.id, 
          amount: quote.total, 
          date: quote.date || "", 
          qty: (quote.items || []).reduce((acc: number, i: any) => acc + Number(i.quantity), 0) 
        }
        return { ...e, quotes: [...(e.quotes || []), newQuote].sort((a, b) => a.date.localeCompare(b.date)) }
      }
      return e
    })

    await updateDoc(logisticsDocRef, { entries: updatedEntries, updatedAt: serverTimestamp() })
    toast({ title: "BOLETA VINCULADA" })
  }

  const handleUnlinkPayment = async (customerId: string, paymentId: string) => {
    if (!db || !logisticsDocRef || !logData) return

    const updatedEntries = logData.entries.map((e: any) => {
      if (e.customerId === customerId) {
        return { ...e, payments: e.payments.filter((p: any) => p.paymentId !== paymentId) }
      }
      return e
    })

    await updateDoc(logisticsDocRef, { entries: updatedEntries, updatedAt: serverTimestamp() })
    toast({ title: "PAGO DESVINCULADO" })
  }

  const handleLinkPayment = async (customerId: string, payment: any) => {
    if (!db || !logisticsDocRef || !logData) return

    const updatedEntries = logData.entries.map((e: any) => {
      if (e.customerId === customerId) {
        const newPayment = { 
          paymentId: payment.id, 
          amount: payment.amount, 
          date: payment.date || "", 
          bank: payment.bankName 
        }
        return { ...e, payments: [...(e.payments || []), newPayment].sort((a, b) => a.date.localeCompare(b.date)) }
      }
      return e
    })

    await updateDoc(logisticsDocRef, { entries: updatedEntries, updatedAt: serverTimestamp() })
    toast({ title: "PAGO VINCULADO" })
  }

  const handleUpdateShippingCost = async (customerId: string, cost: string) => {
    if (!logisticsDocRef || !logData) return
    const val = Number(cost)
    const updatedEntries = logData.entries.map((e: any) => e.customerId === customerId ? { ...e, shippingCost: isNaN(val) ? 0 : val } : e)
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
    toast({ title: "CLIENTE REMOVIDO" })
  }

  return (
    <div className="w-full max-w-4xl mx-auto pt-0 pb-24">
      <Tabs defaultValue="envios" className="w-full">
        <TabsList className="chrome-tab-list sticky top-[57px] z-[45]">
          <TabsTrigger value="clientes" className="chrome-tab-trigger">
            <Users className="w-3 h-3 mr-2 opacity-50" /> CLIENTES
          </TabsTrigger>
          <TabsTrigger value="envios" className="chrome-tab-trigger">
            <Truck className="w-3 h-3 mr-2 opacity-50" /> ENVÍOS
          </TabsTrigger>
        </TabsList>

        <div className="px-1 md:px-0 mt-0">
          <TabsContent value="clientes" className="mt-4 focus-visible:outline-none"><CustomersHubPage /></TabsContent>

          <TabsContent value="envios" className="mt-0 space-y-4 focus-visible:outline-none">
            <div className="bg-[#0f172a] rounded-b-[2rem] p-5 pb-7 space-y-4 shadow-2xl relative overflow-visible">
               <div className="flex items-center justify-between relative z-10">
                  <h1 className="text-[13px] font-black text-white uppercase tracking-widest">LOTE DE ENVÍO</h1>
                  <input 
                    type="date" 
                    value={dateKey} 
                    onChange={(e) => { if (e.target.value) setDate(new Date(e.target.value + "T12:00:00")); }} 
                    className="bg-transparent border-none text-[12px] font-black text-white/80 uppercase focus:outline-none w-28 text-right cursor-pointer" 
                  />
               </div>

               <div className="relative z-20">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input 
                    placeholder="AGREGAR CLIENTE AL LOTE..." 
                    className="h-12 pl-12 bg-white border-slate-300 rounded-xl font-medium text-[11px] uppercase shadow-inner text-slate-800 focus-visible:ring-1 focus-visible:ring-primary/20"
                    value={customerSearch}
                    onChange={e => setCustomerSearch(e.target.value)}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                  />
                  {(isSearchFocused || customerSearch.length >= 1) && (
                    <div className="absolute z-[70] w-full mt-1 bg-white border border-slate-300 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-1">
                      {filteredSuggestions.length === 0 ? (
                        <div className="py-8 text-center opacity-30 text-[9px] font-black uppercase">Sin resultados pendientes</div>
                      ) : (
                        filteredSuggestions.map(c => (
                          <button key={c.id} className="w-full text-left px-5 py-3.5 hover:bg-slate-50 border-b border-slate-100 last:border-0 flex items-center justify-between group transition-colors" onClick={() => handleAddCustomer(c)}>
                            <div className="flex flex-col">
                               <span className="font-bold text-[12px] uppercase text-slate-800 group-hover:text-primary">{c.name}</span>
                               <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{c.id}</span>
                            </div>
                            <Plus className="w-4 h-4 text-primary opacity-40 group-hover:opacity-100" />
                          </button>
                        ))
                      )}
                    </div>
                  )}
               </div>

               <div className="absolute inset-0 rounded-b-[2rem] overflow-hidden pointer-events-none">
                 <Truck className="w-40 h-40 text-white absolute bottom-0 right-0 opacity-5 -mb-8 -mr-8" />
               </div>
            </div>

            <div className="grid grid-cols-3 gap-2 px-4 -mt-3 relative z-10">
               <div className="bg-white border border-slate-300 rounded-xl p-3 text-center shadow-md">
                 <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest block">LOTE FACT.</span>
                 <div className="text-[14px] font-headline font-black text-slate-900 mt-0.5 leading-none">S/ {stats.facturado.toFixed(0)}</div>
               </div>
               <div className="bg-white border border-slate-300 rounded-xl p-3 text-center shadow-md">
                 <span className="text-[7px] font-black text-red-400 uppercase tracking-widest block">DEUDA LOTE</span>
                 <div className="text-[14px] font-headline font-black text-red-600 mt-0.5 leading-none">S/ {stats.deuda.toFixed(0)}</div>
               </div>
               <div className="bg-white border border-slate-300 rounded-xl p-3 text-center shadow-md">
                 <span className="text-[7px] font-black text-blue-400 uppercase tracking-widest block">SALDO FAVOR</span>
                 <div className="text-[14px] font-headline font-black text-blue-600 mt-0.5 leading-none">S/ {stats.favor.toFixed(0)}</div>
               </div>
            </div>

            <div className="px-2 space-y-2 min-h-[220px] relative z-0">
               {(!logData?.entries || logData.entries.length === 0) ? (
                 <div className="bg-white border border-dashed border-slate-300 rounded-[2.5rem] py-16 flex flex-col items-center justify-center gap-4 opacity-30 shadow-inner">
                    <Truck className="w-10 h-10 text-slate-200" />
                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">SIN CLIENTES EN EL LOTE</span>
                 </div>
               ) : (
                 <div className="space-y-1.5">
                    {logData.entries.map((entry: any, index: number) => {
                      const qTotal = (entry.quotes || []).reduce((acc: number, q: any) => acc + Number(q.amount || 0), 0)
                      const pTotal = (entry.payments || []).reduce((acc: number, p: any) => acc + Number(p.amount || 0), 0)
                      const ship = Number(entry.shippingCost || 0)
                      const bal = pTotal - (qTotal + ship)
                      
                      // Buscar actividad posterior (Activos no vinculados)
                      const availableQuotes = allQuotes.filter(q => q.customerId === entry.customerId && q.status === "active")
                      const allProcessedPaymentIdsInSession = new Set(historyBatches.flatMap(b => (b.entries || []).flatMap((e: any) => (e.payments || []).map((p: any) => p.paymentId))))
                      // También los pagos que ya están en el lote actual pero que no son este específico
                      const currentBatchPaymentIds = new Set((logData.entries || []).flatMap((e: any) => (e.payments || []).map((p: any) => p.paymentId)))
                      
                      const availablePayments = allPayments.filter(p => 
                        p.customerId === entry.customerId && 
                        !p.isLocked && 
                        !allProcessedPaymentIdsInSession.has(p.id) &&
                        !currentBatchPaymentIds.has(p.id)
                      )

                      return (
                        <Accordion key={entry.customerId} type="single" collapsible className="w-full">
                          <AccordionItem value={entry.customerId} className="border border-slate-300 rounded-2xl overflow-hidden bg-white shadow-sm">
                            <AccordionTrigger className="w-full hover:no-underline py-2.5 px-4 h-14 transition-colors">
                              <div className="flex items-center justify-between w-full">
                                <div className="flex items-center gap-3 text-left min-w-0 flex-1">
                                  <div className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 flex items-center justify-center font-bold text-[10px] shrink-0 border border-slate-200">{index + 1}</div>
                                  <div className="flex flex-col truncate">
                                    <span className="font-bold text-[12px] uppercase text-slate-800 leading-none truncate">{entry.customerName}</span>
                                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{entry.customerId}</span>
                                  </div>
                                </div>
                                <div className={cn(
                                  "px-2.5 py-0.5 rounded-md font-black text-[11px] text-white ml-auto mr-3 shrink-0 shadow-sm leading-tight",
                                  bal < -0.1 ? "bg-red-600" : bal > 0.1 ? "bg-blue-600" : "bg-[#10b981]"
                                )}>
                                  S/ {Math.abs(bal).toFixed(1)}
                                </div>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="pb-4 pt-2 px-4 border-t border-slate-100 bg-slate-50/30">
                               <div className="flex items-center justify-between gap-4 mb-4">
                                  <div className="flex-1 space-y-0.5">
                                    <Label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">COSTO ENVÍO S/</Label>
                                    <Input 
                                      type="number" 
                                      value={entry.shippingCost || ""} 
                                      onChange={e => handleUpdateShippingCost(entry.customerId, e.target.value)} 
                                      className="h-10 text-[12px] font-black text-center border-slate-300 rounded-xl bg-white shadow-sm"
                                      placeholder="0.0"
                                    />
                                  </div>
                                  <Button variant="ghost" size="icon" className="h-10 w-10 text-red-500 hover:bg-red-50 rounded-xl mt-3" onClick={() => setDeleteConfirm({ id: entry.customerId, name: entry.customerName })}>
                                    <Trash2 className="w-5 h-5" />
                                  </Button>
                               </div>

                               <div className="space-y-4">
                                 {/* SECCIÓN VINCULADOS */}
                                 <div className="space-y-2">
                                    <div className="flex items-center gap-2 px-1">
                                      <div className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                                      <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">LIQUIDADO EN ESTE LOTE (ANTIGUO ARRIBA)</span>
                                    </div>
                                    
                                    <div className="space-y-1">
                                      {(entry.quotes || []).map((q: any) => (
                                        <div key={q.quoteId} className="bg-white border border-slate-200 rounded-xl p-2 px-3 flex justify-between items-center shadow-sm">
                                          <div className="flex items-center gap-3">
                                            <FileText className="w-3.5 h-3.5 text-primary/40" />
                                            <div className="flex flex-col">
                                              <span className="text-[10px] font-bold text-slate-800">{q.quoteId}</span>
                                              <span className="text-[7px] font-medium text-slate-400">{q.date}</span>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-3">
                                            <span className="text-[11px] font-black text-slate-900">S/ {Number(q.amount || 0).toFixed(1)}</span>
                                            <button onClick={() => handleUnlinkQuote(entry.customerId, q.quoteId)} className="text-slate-300 hover:text-red-500 p-1"><X className="w-3.5 h-3.5" /></button>
                                          </div>
                                        </div>
                                      ))}

                                      {(entry.payments || []).map((p: any) => (
                                        <div key={p.paymentId} className="bg-blue-50/50 border border-blue-100 rounded-xl p-2 px-3 flex justify-between items-center">
                                          <div className="flex items-center gap-3">
                                            <CreditCard className="w-3.5 h-3.5 text-blue-400" />
                                            <div className="flex flex-col">
                                              <span className="text-[10px] font-bold text-blue-700">{p.bank}</span>
                                              <span className="text-[7px] font-medium text-blue-400">{p.date}</span>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-3">
                                            <span className="text-[11px] font-black text-blue-600">S/ {Number(p.amount || 0).toFixed(1)}</span>
                                            <button onClick={() => handleUnlinkPayment(entry.customerId, p.paymentId)} className="text-blue-300 hover:text-red-500 p-1"><X className="w-3.5 h-3.5" /></button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                 </div>

                                 {/* SECCIÓN DISPONIBLES (NUEVA ACTIVIDAD) */}
                                 {(availableQuotes.length > 0 || availablePayments.length > 0) && (
                                   <div className="space-y-2 pt-2 border-t border-slate-200 border-dashed">
                                      <div className="flex items-center gap-2 px-1">
                                        <div className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                                        <span className="text-[8px] font-black text-orange-600 uppercase tracking-widest">ACTIVIDAD NUEVA (PARA VINCULAR)</span>
                                      </div>
                                      
                                      <div className="space-y-1 opacity-70">
                                        {availableQuotes.map(q => (
                                          <button 
                                            key={q.id} 
                                            onClick={() => handleLinkQuote(entry.customerId, q)}
                                            className="w-full bg-slate-100 border border-slate-200 rounded-xl p-2 px-3 flex justify-between items-center hover:bg-slate-200 transition-colors"
                                          >
                                            <div className="flex items-center gap-3">
                                              <FileText className="w-3.5 h-3.5 text-slate-400" />
                                              <div className="flex flex-col text-left">
                                                <span className="text-[10px] font-bold text-slate-600">{q.id}</span>
                                                <span className="text-[7px] font-medium text-slate-400">{q.date}</span>
                                              </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <span className="text-[10px] font-black text-slate-500">S/ {Number(q.total || 0).toFixed(1)}</span>
                                              <Plus className="w-3.5 h-3.5 text-slate-400" />
                                            </div>
                                          </button>
                                        ))}

                                        {availablePayments.map(p => (
                                          <button 
                                            key={p.id} 
                                            onClick={() => handleLinkPayment(entry.customerId, p)}
                                            className="w-full bg-blue-50/30 border border-blue-100 rounded-xl p-2 px-3 flex justify-between items-center hover:bg-blue-100/50 transition-colors"
                                          >
                                            <div className="flex items-center gap-3">
                                              <CreditCard className="w-3.5 h-3.5 text-blue-300" />
                                              <div className="flex flex-col text-left">
                                                <span className="text-[10px] font-bold text-blue-600">{p.bankName}</span>
                                                <span className="text-[7px] font-medium text-blue-300">{p.date}</span>
                                              </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <span className="text-[10px] font-black text-blue-500">S/ {Number(p.amount || 0).toFixed(1)}</span>
                                              <Plus className="w-3.5 h-3.5 text-blue-300" />
                                            </div>
                                          </button>
                                        ))}
                                      </div>
                                   </div>
                                 )}
                               </div>
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      )
                    })}
                 </div>
               )}
            </div>

            <div className="px-2 pt-6 space-y-3">
               <div className="flex items-center gap-2 px-2">
                 <History className="w-3.5 h-3.5 text-slate-400" />
                 <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">HISTORIAL DE LOTES</h2>
               </div>
               <div className="space-y-2">
                  {historyBatches.map((batch: any) => {
                    const bTotal = (batch.entries || []).reduce((acc: number, e: any) => {
                      const qt = (e.quotes || []).reduce((a: number, q: any) => a + Number(q.amount || 0), 0)
                      return acc + qt
                    }, 0)
                    
                    const bDebt = (batch.entries || []).reduce((acc: number, e: any) => {
                      const qT = (e.quotes || []).reduce((a: number, q: any) => a + Number(q.amount || 0), 0)
                      const pT = (e.payments || []).reduce((a: number, p: any) => a + Number(p.amount || 0), 0)
                      const ship = Number(e.shippingCost || 0)
                      const bal = pT - (qT + ship)
                      return bal < -0.1 ? acc + Math.abs(bal) : acc
                    }, 0)

                    const bEntriesCount = (batch.entries || []).length
                    if (bEntriesCount === 0 && batch.date !== dateKey) return null

                    return (
                      <Card key={batch.id} className={cn(
                        "rounded-2xl border shadow-sm hover:shadow-md transition-all active:scale-[0.99] group overflow-hidden",
                        batch.date === dateKey ? "border-primary/40 bg-primary/5" : "border-slate-200 bg-white"
                      )}>
                        <CardContent className="p-0 flex items-center justify-between h-14 pr-4">
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            <div className={cn(
                              "w-14 h-14 border-r flex items-center justify-center shrink-0",
                              batch.date === dateKey ? "bg-primary/10 border-primary/10" : "bg-slate-50 border-slate-100"
                            )}>
                              <CalendarDays className={cn("w-5 h-5", batch.date === dateKey ? "text-primary" : "text-slate-400")} />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-[12px] text-slate-800 uppercase truncate">{batch.date}</span>
                                <Badge variant="secondary" className="bg-slate-100 text-slate-500 text-[8px] font-black h-4 px-1.5 border-none uppercase">{bEntriesCount} CL</Badge>
                              </div>
                              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Ventas: S/ {bTotal.toFixed(0)}</div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "px-3 py-1 rounded-lg font-black text-[11px] shadow-sm",
                              bDebt > 0 ? "bg-red-600 text-white" : "bg-slate-100 text-slate-400"
                            )}>
                              S/ {bDebt.toFixed(0)}
                            </div>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-slate-300 hover:text-primary rounded-lg" 
                              onClick={() => { setDate(new Date(batch.date + "T12:00:00")); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                            >
                               <ArrowRight className="w-4 h-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
               </div>
            </div>
          </TabsContent>
        </div>
      </Tabs>

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="rounded-[2rem] max-w-[300px] p-8 text-center border-none shadow-2xl">
          <DialogHeader className="sr-only"><DialogTitle>Confirmar Acción</DialogTitle></DialogHeader>
          <div className="flex flex-col items-center gap-6">
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
              <Trash2 className="w-8 h-8 text-red-500" />
            </div>
            <div className="space-y-2">
               <p className="text-[11px] font-medium uppercase text-slate-800 leading-relaxed">
                ¿REMOVER A <span className="text-red-600 font-bold">{deleteConfirm?.name}</span> DEL Lote?
              </p>
              <p className="text-[9px] text-slate-400 uppercase leading-relaxed font-bold">Las boletas volverán a estado ACTIVO</p>
            </div>
            <div className="grid grid-cols-2 gap-3 w-full">
              <Button variant="outline" className="h-11 rounded-xl font-bold text-[10px] uppercase border-slate-200" onClick={() => setDeleteConfirm(null)}>VOLVER</Button>
              <Button className="h-11 bg-red-600 text-white rounded-xl font-bold text-[10px] uppercase shadow-lg shadow-red-200" onClick={handleRemoveEntry}>CONFIRMAR</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
