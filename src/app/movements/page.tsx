
"use client"

import * as React from "react"
import { 
  History, 
  Search, 
  ArrowUpRight, 
  ArrowDownLeft, 
  RotateCcw, 
  Loader2,
  CalendarDays,
  ChevronDown
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { useCollection, useFirestore, useDoc } from "@/firebase"
import { collection, query, orderBy, where, doc } from "firebase/firestore"
import { cn } from "@/lib/utils"

export default function MovementsPage() {
  const db = useFirestore()
  const [searchQuery, setSearchQuery] = React.useState("")
  const [typeFilter, setTypeFilter] = React.useState("all")
  const [daysLimit, setDaysLimit] = React.useState(15)
  
  const configDocRef = React.useMemo(() => db ? doc(db, "config", "global") : null, [db])
  const { data: config } = useDoc(configDocRef)
  const brandColor = config?.brandColor || "#FF3399"

  const movementsRef = React.useMemo(() => {
    if (!db) return null
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - daysLimit)
    
    return query(
      collection(db, "movements"), 
      where("timestamp", ">=", startDate),
      orderBy("timestamp", "desc")
    )
  }, [db, daysLimit])
  
  const { data: movements = [], loading } = useCollection(movementsRef)

  const filteredMovements = React.useMemo(() => {
    const q = searchQuery.toLowerCase()
    return movements.filter(m => {
      const matchesSearch = m.productCode?.toLowerCase().includes(q) || m.reason?.toLowerCase().includes(q)
      const matchesType = typeFilter === "all" || m.type === typeFilter
      return matchesSearch && matchesType
    })
  }, [movements, searchQuery, typeFilter])

  return (
    <div className="space-y-6 pt-2 pb-24 px-2 md:px-0 max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-primary/10 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-primary/20" style={{ backgroundColor: brandColor }}>
            <History className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-headline font-black text-foreground uppercase tracking-tight">Kardex / Movimientos</h1>
            <p className="text-[9px] font-black text-primary uppercase tracking-[0.2em] mt-0.5">Control de Trazabilidad</p>
          </div>
        </div>
        
        <div className="flex w-full md:w-auto gap-2">
          <div className="relative flex-1 md:w-56">
            <Search className="absolute left-3 top-3 h-4 w-4 text-primary/40" />
            <Input 
              placeholder="" 
              className="pl-9 h-10 rounded-xl border-primary/10 font-black text-[11px] uppercase bg-white shadow-sm"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[110px] h-10 rounded-xl border-primary/10 font-black text-[9px] uppercase bg-white">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all" className="text-[9px] font-black uppercase">Todos</SelectItem>
              <SelectItem value="in" className="text-[9px] font-black uppercase">Entradas</SelectItem>
              <SelectItem value="out" className="text-[9px] font-black uppercase">Salidas</SelectItem>
              <SelectItem value="return" className="text-[9px] font-black uppercase">Retornos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-30">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="text-[9px] font-black uppercase tracking-widest">Cargando Historial...</span>
          </div>
        ) : filteredMovements.length === 0 ? (
          <div className="p-20 text-center opacity-20 font-black text-[10px] uppercase tracking-widest bg-white rounded-[2rem] border border-dashed">
            Sin movimientos en los últimos {daysLimit} días
          </div>
        ) : (
          <>
            {filteredMovements.map((m, idx) => {
              const date = m.timestamp?.toDate ? m.timestamp.toDate() : new Date()
              return (
                <Card key={m.id || idx} className="rounded-2xl border border-primary/5 bg-white shadow-sm hover:shadow-md transition-all overflow-hidden">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center shadow-inner",
                        m.type === 'in' ? "bg-green-50 text-green-600" : 
                        m.type === 'out' ? "bg-orange-50 text-orange-600" : 
                        "bg-blue-50 text-blue-600"
                      )}>
                        {m.type === 'in' ? <ArrowDownLeft className="w-5 h-5" /> : 
                         m.type === 'out' ? <ArrowUpRight className="w-5 h-5" /> : 
                         <RotateCcw className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-[12px] text-foreground uppercase tracking-tight">{m.productCode}</span>
                          <Badge variant="outline" className={cn(
                            "text-[7px] font-black px-2 py-0 border-none uppercase",
                            m.type === 'in' ? "bg-green-100 text-green-700" : 
                            m.type === 'out' ? "bg-orange-100 text-orange-700" : 
                            "bg-blue-100 text-blue-700"
                          )}>
                            {m.type === 'in' ? 'ENTRADA' : m.type === 'out' ? 'SALIDA' : 'RETORNO'}
                          </Badge>
                        </div>
                        <p className="text-[10px] font-medium text-muted-foreground uppercase leading-tight line-clamp-1">{m.reason}</p>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="font-headline font-black text-lg leading-none">
                        {m.type === 'in' || m.type === 'return' ? '+' : '-'}{m.quantity} <span className="text-[9px]">UND</span>
                      </div>
                      <div className="text-[8px] font-black text-primary/30 uppercase tracking-widest mt-1">
                        {date.toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
            
            <div className="flex justify-center pt-6 pb-12">
              <Button 
                variant="outline" 
                className="h-10 rounded-xl border-primary/20 text-primary font-black uppercase text-[9px] tracking-[0.2em] px-8 bg-white shadow-sm hover:bg-primary/5"
                onClick={() => setDaysLimit(prev => prev + 15)}
              >
                <ChevronDown className="w-4 h-4 mr-2" /> Cargar 15 días anteriores
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
