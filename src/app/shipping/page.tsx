
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
  PackageCheck
} from "lucide-react"
import { format } from "date-fns"
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

  const dateKey = format(date, "yyyy-MM-dd")
  const logisticsDocRef = React.useMemo(() => db ? doc(db, "logistics", dateKey) : null, [db, dateKey])
  const { data: logData } = useDoc(logisticsDocRef)
  
  const allLogisticsRef = React.useMemo(() => db ? query(collection(db, "logistics"), orderBy("date", "desc")) : null, [db])
  const { data: historyBatches = [] } = useCollection(allLogisticsRef)

  const customersRef = React.useMemo(() => db ? query(collection(db, "customers"), orderBy("id", "desc")) : null, [db])
  const { data: dbCustomers = [] } = useCollection(customersRef)
  
  const allQuotesRef = React.useMemo(() => db ? collection(db, "quotes") : null, [db])
  const allPaymentsRef = React.useMemo(() => db ? collection(db, "payments") : null, [db])
  const { data: allQuotes = [] } = useCollection(allQuotesRef)
  const { data: allPayments = [] } = useCollection(allPaymentsRef)

  const activeCustomerSuggestions = React.useMemo(() => {
    // Solo mostramos clientes con boletas activas o pagos no bloqueados
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

    // Cambiar estado a ENVIADO en Firestore
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
    toast({ title: "CLIENTE AÑADIDO", description: "Boletas marcadas como ENVIADO" })
  }

  const handleUpdateShippingCost = async (customerId: string, cost: string) => {
    if (!logisticsDocRef || !logData) return
    const val = Number(cost)
    const updatedEntries = logData.entries.map((e: any) => e.customerId === customerId ? { ...e, shippingCost: isNaN(val) ? 0 : val } : e)
    await updateDoc(logisticsDocRef, { entries: updatedEntries, updatedAt: serverTimestamp() })
  }

  const handleRemoveItemFromEntry = async (customerId: string, itemId: string, type: 'quote' | 'payment') => {
    if (!db || !logisticsDocRef || !logData) return
    
    // Si quitamos una boleta, regresa a estado ACTIVO
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
    toast({ title: type === 'quote' ? "Boleta regresó a estado ACTIVO" : "Pago removido" })
  }

  const handleRemoveEntry = async () => {
    if (!db || !logisticsDocRef || !logData || !deleteConfirm) return
    
    const entryToRemove = logData.entries.find((e: any) => e.customerId === deleteConfirm.id)
    
    // Regresar todas las boletas del cliente a estado ACTIVO
    if (entryToRemove && entryToRemove.quotes) {
      for (const q of entryToRemove.quotes) {
        updateDoc(doc(db, "quotes", q.quoteId), { status: 'active' }).catch(() => {})
      }
    }

    const updatedEntries = logData.entries.filter((e: any) => e.customerId !== deleteConfirm.id)
    await updateDoc(logisticsDocRef, { entries: updatedEntries, updatedAt: serverTimestamp() })
    setDeleteConfirm(null)
    toast({ title: "Lote del cliente cancelado (Boletas ACTIVAS)" })
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
              <h1 className="text-xl font-headline font-black text-foreground uppercase tracking-tight">ENVIOS</h1>
            </div>
            <div className="flex items-center justify-between w-full md:w-auto gap-6">
              <div className="text-right flex flex-col items-end">
                <span className="text-[8px] font-black text-primary/40 uppercase tracking-widest">TOTAL LOTE</span>
                <div className="flex items-end gap-1">
                  <span className="text-[10px] font-black text-primary mb-0.5">S/</span>
                  <span className="text-2xl font-headline font-black text-foreground leading-none">{batchTotal.toFixed(1)}</span>
                </div>
              </div>
              <input 
                type="date" 
                value={dateKey} 
                onChange={(e) => { if (e.target.value) setDate(new Date(e.target.value + "T12:00:00")); }} 
                className="h-10 px-3 rounded-xl border-2 border-primary/10 font-black text-[11px] uppercase bg-white focus:outline-none focus:border-primary" 
              />
            </div>
          </div>

          <div className="relative w-full z-[100]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/40" />
            <Input 
              placeholder="BUSCAR CLIENTE PENDIENTE..." 
              className="pl-11 h-11 w-full rounded-xl border-2 border-primary/10 font-black text-xs uppercase shadow-sm" 
              value={customerSearch} 
              onChange={e => setCustomerSearch(e.target.value)} 
              onFocus={() => setIsSearchOpen(true)} 
            />
            {isSearchOpen && (
              <div className="absolute z-[9999] w-full mt-1 bg-white border-2 border-primary/10 rounded-xl shadow-2xl overflow-hidden">
                <div className="p-2 bg-primary/5 border-b border-primary/5 flex justify-between items-center px-4">
                  <span className="text-[8px] font-black uppercase text-primary tracking-widest">Sugerencias</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsSearchOpen(false)}><X className="w-3.5 h-3.5" /></Button>
                </div>
                <div className="max-h-[250px] overflow-y-auto">
                  {filteredSuggestions.length === 0 ? (
                    <div className="p-10 text-center opacity-20 text-[9px] font-black uppercase">Sin boletas activas</div>
                  ) : filteredSuggestions.map(c => (
                    <button key={c.id} className="w-full text-left px-5 py-3 hover:bg-primary/5 border-b last:border-0 flex items-center justify-between group" onClick={() => handleAddCustomer(c)}>
                      <div className="flex flex-col">
                        <span className="font-black text-[11px] uppercase group-hover:text-primary transition-colors">{c.name}</span>
                        <span className="text-[8px] font-bold text-primary/40 uppercase">{c.id}</span>
                      </div>
                      <Plus className="w-3.5 h-3.5 text-primary" />
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
                    <AccordionTrigger className="w-full hover:no-underline py-2.5 px-4 h-12">
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-3 text-left min-w-0 flex-1">
                          <span className="w-6 h-6 rounded-md bg-primary/5 text-primary flex items-center justify-center font-black text-[10px] shrink-0">{index + 1}</span>
                          <div className="flex flex-col truncate">
                            <span className="font-black text-[12px] uppercase text-black leading-none truncate">{entry.customerName}</span>
                            <span className="text-[8px] font-bold text-primary/40 uppercase">{entry.customerId}</span>
                          </div>
                        </div>
                        <div className={cn("px-2.5 py-1 rounded-md font-black text-[11px] text-white ml-auto mr-2 shrink-0", balance < -0.1 ? "bg-red-600" : balance > 0.1 ? "bg-blue-600" : "bg-green-600")}>
                          {Math.abs(balance).toFixed(1)}
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-4 pt-2 px-4 border-t border-primary/5 bg-primary/[0.01]">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between h-9 bg-white px-3 rounded-lg border border-primary/10">
                          <div className="flex items-center gap-3 flex-1">
                            <Label className="text-[9px] font-black text-primary uppercase shrink-0">ENVÍO</Label>
                            <div className="relative flex-1 max-w-[100px]">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 font-black text-[8px] text-primary/40">S/</span>
                              <Input 
                                type="number" 
                                value={entry.shippingCost || ""} 
                                onChange={e => handleUpdateShippingCost(entry.customerId, e.target.value)} 
                                className="h-6 pl-6 text-[10px] font-black bg-primary/5 border-none w-full text-center" 
                              />
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => setDeleteConfirm({ id: entry.customerId, name: entry.customerName })}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        
                        <div className="space-y-1">
                          <div className="px-1 mb-1 border-b border-primary/5"><span className="text-[8px] font-black uppercase text-primary/40">BOLETAS</span></div>
                          {(entry.quotes || []).map((q: any) => (
                            <div key={q.quoteId} className="flex items-center justify-between h-8 px-3 rounded-md border bg-white border-primary/10">
                              <span className="text-[10px] font-black uppercase truncate flex-1">{q.quoteId} | {q.qty} UND</span>
                              <div className="flex items-center gap-4">
                                <span className="text-[10px] font-black text-primary">S/ {Number(q.amount).toFixed(1)}</span>
                                <button onClick={() => handleRemoveItemFromEntry(entry.customerId, q.quoteId, 'quote')} className="text-black/20 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="space-y-1">
                          <div className="px-1 mb-1 border-b border-primary/5"><span className="text-[8px] font-black uppercase text-primary/40">PAGOS</span></div>
                          {(entry.payments || []).map((p: any) => (
                            <div key={p.paymentId} className="flex items-center justify-between h-8 px-3 rounded-md border bg-green-50/50 border-green-200">
                              <span className="text-[10px] font-black text-green-700 flex-1">S/ {Number(p.amount).toFixed(1)}</span>
                              <button onClick={() => handleRemoveItemFromEntry(entry.customerId, p.paymentId, 'payment')} className="text-black/20 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
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

          <div className="pt-6 space-y-3">
            <div className="flex items-center gap-2 border-b border-black/10 pb-1">
              <History className="w-3.5 h-3.5 text-black/40" />
              <h2 className="text-[10px] font-black uppercase tracking-tight text-black/60">Historial de Lotes</h2>
            </div>
            <div className="space-y-1.5">
              {historyBatches.map(batch => {
                let hDebt = false, isZero = true;
                (batch.entries || []).forEach((e: any) => { 
                  const b = calculateEntryBalance(e); 
                  if (b < -0.1) { hDebt = true; isZero = false; } 
                  else if (b > 0.1) isZero = false; 
                });
                return (
                  <Card key={batch.date} className="rounded-lg border border-black/5 bg-white shadow-sm">
                    <CardContent className="p-2.5 flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase">{format(new Date(batch.date + "T12:00:00"), "EEEE d 'DE' MMMM", { locale: es }).toUpperCase()}</span>
                        <span className="text-[8px] font-black text-primary/40 uppercase">{batch.entries?.length || 0} CLIENTES</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn("text-[8px] font-black h-5 px-2 uppercase border-none rounded-md", isZero ? "bg-slate-100 text-slate-500" : hDebt ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600")}>
                          {isZero ? "CUADRADO" : hDebt ? "DEUDA" : "EXCEDENTE"}
                        </Badge>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-primary hover:bg-primary/5" onClick={() => { setDate(new Date(batch.date + "T12:00:00")); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        </TabsContent>
      </Tabs>
      
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="rounded-[2rem] max-w-[280px] p-8 text-center border-none shadow-2xl">
          <DialogHeader className="sr-only"><DialogTitle>Confirmar Eliminación</DialogTitle></DialogHeader>
          <div className="flex flex-col items-center gap-6">
            <p className="text-[11px] font-black uppercase text-black/60">¿REMOVER DEL LOTE Y ACTIVAR BOLETAS?</p>
            <div className="grid grid-cols-2 gap-3 w-full">
              <Button variant="outline" className="h-11 rounded-xl font-black text-[10px] uppercase" onClick={() => setDeleteConfirm(null)}>NO</Button>
              <Button className="h-11 bg-red-600 text-white rounded-xl font-black text-[10px] uppercase" onClick={handleRemoveEntry}>SÍ</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
