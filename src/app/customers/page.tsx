
"use client"

import * as React from "react"
import { 
  Users,
  Search,
  UserPlus,
  ChevronRight,
  ChevronDown,
  ArrowUpRight,
  ArrowDownLeft,
  CircleDollarSign,
  History,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { useCollection, useFirestore, useDoc } from "@/firebase"
import { collection, query, orderBy, doc } from "firebase/firestore"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { es } from "date-fns/locale"

export default function CustomersHubPage() {
  const db = useFirestore()
  const [searchQuery, setSearchQuery] = React.useState("")
  
  const configDocRef = React.useMemo(() => db ? doc(db, "config", "global") : null, [db])
  const { data: config } = useDoc(configDocRef)
  const brandColor = config?.brandColor || "#0296FF"

  const customersRef = React.useMemo(() => db ? query(collection(db, "customers"), orderBy("id", "asc")) : null, [db])
  const quotesRef = React.useMemo(() => db ? query(collection(db, "quotes"), orderBy("createdAt", "asc")) : null, [db])
  const paymentsRef = React.useMemo(() => db ? query(collection(db, "payments"), orderBy("createdAt", "asc")) : null, [db])

  const { data: customers = [], loading: cLoading } = useCollection(customersRef)
  const { data: quotes = [] } = useCollection(quotesRef)
  const { data: payments = [] } = useCollection(paymentsRef)

  const customerData = React.useMemo(() => {
    return customers.map(c => {
      const cQuotes = quotes.filter(q => q.customerId === c.id && q.status !== 'annulled')
      const cPayments = payments.filter(p => p.customerId === c.id)
      
      const totalInvoiced = cQuotes.reduce((acc, q) => acc + (q.total || 0), 0)
      const totalPaid = cPayments.reduce((acc, p) => acc + (p.amount || 0), 0)
      const balance = totalPaid - totalInvoiced

      const ledger = [...cQuotes.map(q => ({ type: 'quote', date: q.createdAt?.toDate ? q.createdAt.toDate() : new Date(), id: q.id, amount: q.total })),
                      ...cPayments.map(p => ({ type: 'payment', date: p.createdAt?.toDate ? p.createdAt.toDate() : new Date(), id: 'PAGO', amount: p.amount }))]
                      .sort((a, b) => a.date.getTime() - b.date.getTime())

      let runningBalance = 0
      const history = ledger.map(entry => {
        if (entry.type === 'quote') runningBalance -= entry.amount
        else runningBalance += entry.amount
        return { ...entry, currentBalance: runningBalance }
      })

      return {
        ...c,
        totalInvoiced,
        totalPaid,
        balance,
        history
      }
    })
  }, [customers, quotes, payments])

  const filtered = React.useMemo(() => {
    const q = searchQuery.toLowerCase()
    return customerData.filter(c => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q))
  }, [customerData, searchQuery])

  const sections = [
    { 
      title: "CUENTAS POR COBRAR", 
      color: "text-red-600", 
      bgColor: "bg-red-50", 
      borderColor: "border-red-200",
      icon: AlertCircle,
      data: filtered.filter(c => c.balance < -1).sort((a, b) => a.balance - b.balance)
    },
    { 
      title: "SALDOS A FAVOR", 
      color: "text-blue-600", 
      bgColor: "bg-blue-50", 
      borderColor: "border-blue-200",
      icon: CircleDollarSign,
      data: filtered.filter(c => c.balance > 1).sort((a, b) => b.balance - a.balance)
    },
    { 
      title: "CLIENTES AL DÍA", 
      color: "text-green-600", 
      bgColor: "bg-green-50", 
      borderColor: "border-green-200",
      icon: CheckCircle2,
      data: filtered.filter(c => Math.abs(c.balance) <= 1)
    },
    { 
      title: "HISTORIAL DE ENVÍOS CERRADOS", 
      color: "text-slate-600", 
      bgColor: "bg-slate-50", 
      borderColor: "border-slate-200",
      icon: Clock,
      data: [] // Opcional: Cargar desde logistics si fuera necesario
    }
  ]

  return (
    <div className="space-y-6 pt-2 pb-24 px-2 md:px-0 max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b-2 border-black pb-4">
        <div>
          <h1 className="text-3xl font-headline font-black text-black uppercase tracking-tight">GESTIÓN DE CLIENTES</h1>
        </div>
        <div className="flex w-full md:w-auto gap-3">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-primary" />
            <Input 
              placeholder="BUSCAR..." 
              className="pl-10 h-11 rounded-xl border-black/10 font-black text-xs uppercase"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      <Accordion type="multiple" className="space-y-4">
        {sections.map((section, sIdx) => {
          const totalSection = section.data.reduce((acc, c) => acc + Math.abs(c.balance), 0)
          return (
            <AccordionItem key={sIdx} value={`section-${sIdx}`} className={cn("border-2 rounded-[2.5rem] overflow-hidden shadow-sm", section.borderColor)}>
              <AccordionTrigger className={cn("px-8 py-5 hover:no-underline", section.bgColor)}>
                <div className="flex items-center justify-between w-full pr-4">
                  <div className="flex items-center gap-4">
                    <section.icon className={cn("w-6 h-6", section.color)} />
                    <span className={cn("font-black text-[12px] uppercase tracking-[0.2em]", section.color)}>
                      {section.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-6">
                    <span className={cn("font-headline font-black text-lg", section.color)}>
                      {totalSection > 0 ? `S/ ${totalSection.toFixed(1)}` : '-'}
                    </span>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="bg-white p-0">
                {section.data.length === 0 ? (
                  <div className="p-10 text-center opacity-20 font-black text-[10px] uppercase tracking-widest">Sin registros en esta sección</div>
                ) : (
                  <div className="divide-y divide-black/5">
                    {section.data.map((c, idx) => (
                      <Accordion key={c.id} type="single" collapsible className="w-full">
                        <AccordionItem value={c.id} className="border-none">
                          <AccordionTrigger className="px-8 py-6 hover:bg-black/[0.02] transition-colors w-full flex justify-between group hover:no-underline">
                            <div className="flex items-center gap-6 w-full pr-10">
                              <span className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center font-black text-[11px] text-black/40">{idx + 1}</span>
                              <div className="flex-1 text-left">
                                <div className="font-black text-[13px] text-black uppercase">{c.name}</div>
                                <div className="text-[9px] font-black text-black/40 uppercase tracking-widest">{c.id} • FACTURADO: S/ {c.totalInvoiced.toFixed(1)}</div>
                              </div>
                              <div className={cn("font-headline font-black text-xl", section.color)}>
                                S/ {Math.abs(c.balance).toFixed(1)}
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-8 pb-8">
                            <div className="rounded-3xl border border-black/5 overflow-hidden bg-black/[0.01]">
                              <table className="w-full text-left text-[10px] font-black uppercase">
                                <thead className="bg-black/5">
                                  <tr>
                                    <th className="px-6 py-3 w-32">FECHA</th>
                                    <th className="px-6 py-3">COTIZACIÓN</th>
                                    <th className="px-6 py-3 text-center">PAGOS</th>
                                    <th className="px-6 py-3 text-right">BALANCE</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {c.history.map((h, hIdx) => (
                                    <tr key={hIdx} className="border-b border-black/5 last:border-0 h-12">
                                      <td className="px-6 py-0 font-medium text-black/60">{format(h.date, "dd/MM/yy")}</td>
                                      <td className="px-6 py-0">
                                        {h.type === 'quote' ? (
                                          <div className="flex flex-col">
                                            <span>{h.id}</span>
                                            <span className="text-[8px] text-red-500">- S/ {h.amount.toFixed(1)}</span>
                                          </div>
                                        ) : '-'}
                                      </td>
                                      <td className="px-6 py-0 text-center">
                                        {h.type === 'payment' ? (
                                          <div className="flex flex-col">
                                            <span className="text-blue-600">+ S/ {h.amount.toFixed(1)}</span>
                                          </div>
                                        ) : '-'}
                                      </td>
                                      <td className={cn("px-6 py-0 text-right font-headline", h.currentBalance < 0 ? "text-red-600" : "text-blue-600")}>
                                        S/ {h.currentBalance.toFixed(1)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
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
