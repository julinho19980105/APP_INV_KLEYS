
"use client"

import * as React from "react"
import { 
  Users,
  Search,
  ChevronDown,
  CircleDollarSign,
  AlertCircle,
  CheckCircle2,
  Truck,
  Loader2,
  UserMinus
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { useCollection, useFirestore, useDoc } from "@/firebase"
import { collection, query, orderBy, doc, limit } from "firebase/firestore"
import { cn } from "@/lib/utils"
import { format } from "date-fns"

export default function CustomersHubPage() {
  const db = useFirestore()
  const [searchQuery, setSearchQuery] = React.useState("")
  
  const configDocRef = React.useMemo(() => db ? doc(db, "config", "global") : null, [db])
  const config = useDoc(configDocRef).data
  const brandColor = config?.brandColor || "#0296FF"

  const customersRef = React.useMemo(() => db ? query(collection(db, "customers"), orderBy("name", "asc")) : null, [db])
  const quotesRef = React.useMemo(() => db ? query(collection(db, "quotes"), orderBy("createdAt", "asc")) : null, [db])
  const paymentsRef = React.useMemo(() => db ? query(collection(db, "payments"), orderBy("createdAt", "asc")) : null, [db])
  const logisticsRef = React.useMemo(() => db ? query(collection(db, "logistics"), orderBy("date", "desc"), limit(100)) : null, [db])

  const { data: customers = [], loading: cLoading } = useCollection(customersRef)
  const { data: quotes = [] } = useCollection(quotesRef)
  const { data: payments = [] } = useCollection(paymentsRef)
  const { data: logistics = [] } = useCollection(logisticsRef)

  const customerData = React.useMemo(() => {
    return customers.map(c => {
      const cQuotes = quotes.filter(q => q.customerId === c.id && q.status !== 'annulled')
      const activeQuotes = cQuotes.filter(q => q.status === 'active')
      const cPayments = payments.filter(p => p.customerId === c.id)
      
      const totalInvoiced = cQuotes.reduce((acc, q) => acc + (q.total || 0), 0)
      const totalPaid = cPayments.reduce((acc, p) => acc + (p.amount || 0), 0)
      
      const shipmentHistory = logistics.flatMap(l => 
        (l.entries || [])
          .filter((e: any) => e.customerId === c.id)
          .map((e: any) => ({ ...e, dateKey: l.date }))
      ).sort((a, b) => b.dateKey.localeCompare(a.dateKey))

      const processedPaymentIds = new Set(shipmentHistory.flatMap(h => (h.payments || []).map((p: any) => p.paymentId)))
      const unlockedPayments = cPayments.filter(p => !p.isLocked && !processedPaymentIds.has(p.id))

      const totalShippingCost = shipmentHistory.reduce((acc, h) => acc + Number(h.shippingCost || 0), 0)
      const balance = totalPaid - (totalInvoiced + totalShippingCost)

      const ledger = [...cQuotes.map(q => ({ type: 'quote', date: q.createdAt?.toDate ? q.createdAt.toDate() : new Date(), id: q.id, amount: q.total })),
                      ...cPayments.map(p => ({ type: 'payment', date: p.createdAt?.toDate ? p.createdAt.toDate() : new Date(), id: 'PAGO', amount: p.amount })),
                      ...shipmentHistory.map(h => ({ type: 'shipping', date: new Date(h.dateKey + "T12:00:00"), id: 'ENVIO', amount: Number(h.shippingCost || 0) }))]
                      .sort((a, b) => a.date.getTime() - b.date.getTime())

      let runningBalance = 0
      const history = ledger.map(entry => {
        if (entry.type === 'quote' || entry.type === 'shipping') runningBalance -= entry.amount
        else runningBalance += entry.amount
        return { ...entry, currentBalance: runningBalance }
      })

      const isShipped = shipmentHistory.length > 0
      const hasActiveBusiness = activeQuotes.length > 0 || unlockedPayments.length > 0
      const isInactive = !isShipped && !hasActiveBusiness

      return {
        ...c,
        totalInvoiced,
        totalPaid,
        balance,
        history,
        shipmentHistory,
        isShipped,
        hasActiveBusiness,
        isInactive
      }
    })
  }, [customers, quotes, payments, logistics])

  const filtered = React.useMemo(() => {
    const q = searchQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    return customerData.filter(c => c.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q) || c.id.toLowerCase().includes(q))
  }, [customerData, searchQuery])

  const totalInStreet = React.useMemo(() => {
    return customerData
      .filter(c => c.balance < -1 && !c.isInactive)
      .reduce((acc, c) => acc + Math.abs(c.balance), 0)
  }, [customerData])

  const debtorCount = React.useMemo(() => {
    return customerData.filter(c => c.balance < -1 && !c.isInactive).length
  }, [customerData])

  const sections = React.useMemo(() => {
    const shipped = filtered.filter(c => c.isShipped)
    const activeCycle = filtered.filter(c => !c.isShipped && c.hasActiveBusiness)
    const inactive = filtered.filter(c => c.isInactive)

    return [
      { 
        title: "CUENTAS POR COBRAR", 
        color: "text-red-500", 
        lineColor: "bg-red-200",
        icon: AlertCircle,
        data: activeCycle.filter(c => c.balance < -1).sort((a, b) => a.balance - b.balance)
      },
      { 
        title: "SALDOS A FAVOR", 
        color: "text-blue-500", 
        lineColor: "bg-blue-200",
        icon: CircleDollarSign,
        data: activeCycle.filter(c => c.balance > 1).sort((a, b) => b.balance - a.balance)
      },
      { 
        title: "ACTIVOS / AL DÍA", 
        color: "text-emerald-500", 
        lineColor: "bg-emerald-200",
        icon: CheckCircle2,
        data: activeCycle.filter(c => Math.abs(c.balance) <= 1)
      },
      { 
        title: "HISTORIAL DE ENVÍOS CERRADOS", 
        color: "text-slate-400", 
        lineColor: "bg-slate-200",
        icon: Truck,
        data: shipped
      },
      { 
        title: "CLIENTES SIN COMPRAS", 
        color: "text-slate-300", 
        lineColor: "bg-slate-100",
        icon: UserMinus,
        data: inactive
      }
    ]
  }, [filtered])

  return (
    <div className="space-y-4 pt-1 pb-24 px-2 md:px-0 max-w-4xl mx-auto animate-in fade-in duration-700">
      <div className="bg-[#0f172a] rounded-[2rem] p-6 shadow-2xl flex items-center justify-between relative overflow-hidden">
        <div className="flex items-center gap-5 relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-[#0296FF] flex items-center justify-center shadow-lg shadow-blue-500/20">
            <CircleDollarSign className="w-8 h-8 text-white" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.2em] leading-none">TOTAL EN CALLE</span>
            <div className="text-3xl font-headline font-black text-white mt-1 leading-none">S/ {totalInStreet.toFixed(1)}</div>
          </div>
        </div>
        <div className="text-right relative z-10">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">DEUDORAS</span>
          <div className="text-3xl font-headline font-black text-white mt-1 leading-none">{debtorCount}</div>
        </div>
        <div className="absolute right-0 bottom-0 opacity-5 pointer-events-none">
           <Users className="w-40 h-40 text-white -mb-10 -mr-10" />
        </div>
      </div>

      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 transition-colors group-focus-within:text-primary" />
        <Input 
          placeholder="BUSCAR POR NOMBRE O CÓDIGO..." 
          className="pl-11 h-12 rounded-2xl border-slate-200 bg-white font-medium text-[11px] uppercase shadow-sm focus:ring-1 focus:ring-primary/10"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      <Accordion type="multiple" className="space-y-1">
        {sections.map((section, sIdx) => {
          const sectionTotal = section.data.reduce((acc, c) => acc + Math.abs(c.balance), 0)
          return (
            <AccordionItem key={sIdx} value={`section-${sIdx}`} className="border-none">
              <AccordionTrigger className="hover:no-underline py-4 px-2 group">
                <div className="flex items-center gap-3 w-full">
                  <div className={cn("flex items-center gap-2 shrink-0 font-bold text-[11px] uppercase tracking-wider", section.color)}>
                     <section.icon className="w-4 h-4" />
                     <span>{sIdx + 1}. {section.title}</span>
                     {sIdx < 3 && <span className="ml-1 opacity-70">(S/ {sectionTotal.toFixed(1)})</span>}
                  </div>
                  <div className={cn("flex-1 h-[1px] ml-2", section.lineColor)} />
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-0">
                {section.data.length === 0 ? (
                  <div className="py-10 text-center opacity-20 font-bold text-[9px] uppercase tracking-widest bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 mx-2">Sin registros</div>
                ) : (
                  <div className="space-y-1 px-2">
                    {section.data.map((c, idx) => (
                      <Accordion key={c.id} type="single" collapsible className="w-full">
                        <AccordionItem value={c.id} className="border-none">
                          <AccordionTrigger className="px-4 py-3.5 hover:bg-slate-50/80 rounded-xl transition-all w-full flex justify-between group/item hover:no-underline border border-transparent hover:border-slate-200">
                            <div className="flex items-center gap-4 w-full text-left">
                              <span className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center font-bold text-[9px] text-slate-400 shrink-0 border border-slate-200">{idx + 1}</span>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-[12px] text-slate-800 uppercase truncate leading-tight">{c.name}</div>
                                <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{c.id}</div>
                              </div>
                              <div className={cn("font-headline font-black text-[14px] px-3 py-1 rounded-lg border", 
                                sIdx === 3 ? (
                                  c.balance < -1 ? "text-red-500 bg-red-50 border-red-100" : "text-slate-400 bg-slate-50 border-slate-200"
                                ) : (
                                  c.balance < -1 ? "text-red-500 bg-red-50 border-red-100" : 
                                  c.balance > 1 ? "text-blue-500 bg-blue-50 border-blue-100" : 
                                  "text-emerald-500 bg-emerald-50 border-emerald-100"
                                )
                              )}>
                                {sIdx === 3 ? (
                                  c.balance < -1 ? `S/ ${Math.abs(c.balance).toFixed(1)}` : "0.0"
                                ) : `S/ ${Math.abs(c.balance).toFixed(1)}`}
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-1 pb-4 pt-1">
                            {sIdx === 4 ? (
                              <div className="py-8 text-center text-[10px] font-bold uppercase text-slate-300 tracking-widest border border-dashed rounded-2xl mx-1">Cliente sin actividad registrada</div>
                            ) : (
                              <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-sm mx-1">
                                <table className="w-full text-left text-[9px] font-medium uppercase">
                                  <thead className="bg-slate-900 border-b border-slate-800 text-white">
                                    {sIdx === 3 ? (
                                      <tr>
                                        <th className="px-4 py-2 text-slate-400">FECHA ENVÍO</th>
                                        <th className="px-4 py-2 text-slate-400">BOLETAS</th>
                                        <th className="px-4 py-2 text-right text-slate-400">COSTO ENVÍO</th>
                                      </tr>
                                    ) : (
                                      <tr>
                                        <th className="px-4 py-2 text-slate-400">FECHA</th>
                                        <th className="px-4 py-2 text-slate-400">REFERENCIA / MONTO</th>
                                        <th className="px-4 py-2 text-right text-slate-400">SALDO</th>
                                      </tr>
                                    )}
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {sIdx === 3 ? (
                                      c.shipmentHistory.map((h: any, hIdx: number) => (
                                        <tr key={hIdx} className="hover:bg-slate-50/50">
                                          <td className="px-4 py-3 text-slate-600">{format(new Date(h.dateKey + "T12:00:00"), "dd/MM/yy")}</td>
                                          <td className="px-4 py-3">
                                            <div className="flex gap-1 flex-wrap">
                                              {(h.quotes || []).map((q: any) => (
                                                <Badge key={q.quoteId} variant="outline" className="text-[7px] font-bold border-blue-100 text-blue-500 h-4">{q.quoteId}</Badge>
                                              ))}
                                            </div>
                                          </td>
                                          <td className="px-4 py-3 text-right font-headline text-slate-700">S/ {Number(h.shippingCost || 0).toFixed(1)}</td>
                                        </tr>
                                      ))
                                    ) : (
                                      c.history.map((h, hIdx) => (
                                        <tr key={hIdx} className="hover:bg-slate-50/50">
                                          <td className="px-4 py-3 text-slate-500">{format(h.date, "dd/MM/yy")}</td>
                                          <td className="px-4 py-3">
                                            <div className="flex flex-col gap-0.5">
                                               <span className="text-slate-700 font-medium">{h.id}</span>
                                               <span className={cn("font-bold text-[10px]", 
                                                 h.type === 'quote' || h.type === 'shipping' ? "text-red-500" : "text-blue-500")}>
                                                 S/ {h.amount.toFixed(1)}
                                               </span>
                                            </div>
                                          </td>
                                          <td className={cn(
                                            "px-4 py-3 text-right font-headline font-bold text-[11px]",
                                            h.currentBalance < -0.1 ? "text-red-500" : h.currentBalance > 0.1 ? "text-emerald-500" : "text-red-500"
                                          )}>
                                            S/ {h.currentBalance.toFixed(1)}
                                          </td>
                                        </tr>
                                      ))
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>
    </div>
  )
}
