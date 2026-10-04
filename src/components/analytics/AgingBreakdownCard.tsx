import React from 'react'
import { AgingBucket } from '@/services/analyticsService'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Clock, Info, ShieldCheck } from 'lucide-react'
import { formatINR } from '@/lib/utils'

interface AgingBreakdownCardProps {
  buckets: AgingBucket[]
  totalOutstanding: number
}

export const AgingBreakdownCard: React.FC<AgingBreakdownCardProps> = ({
  buckets,
  totalOutstanding,
}) => {
  const getBucketColor = (index: number) => {
    switch (index) {
      case 0:
        return 'bg-emerald-500 text-emerald-800'
      case 1:
        return 'bg-teal-500 text-teal-800'
      case 2:
        return 'bg-amber-500 text-amber-800'
      case 3:
        return 'bg-orange-500 text-orange-800'
      default:
        return 'bg-rose-500 text-rose-800'
    }
  }

  const getBucketBorder = (index: number) => {
    switch (index) {
      case 0:
        return 'border-emerald-200 bg-emerald-50/30'
      case 1:
        return 'border-teal-200 bg-teal-50/30'
      case 2:
        return 'border-amber-200 bg-amber-50/30'
      case 3:
        return 'border-orange-200 bg-orange-50/30'
      default:
        return 'border-rose-200 bg-rose-50/30'
    }
  }

  return (
    <Card className="rounded-3xl border border-slate-200 shadow-sm overflow-hidden bg-white">
      <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-800 flex items-center justify-center font-bold">
              <Clock className="w-4 h-4 text-rose-600" />
            </div>
            <div>
              <CardTitle className="text-sm font-extrabold text-slate-900">
                Credit Aging Breakdown
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Time elapsed since credit was recorded in notebook
              </CardDescription>
            </div>
          </div>
          <span className="text-xs font-black text-rose-900 bg-rose-100/70 px-2.5 py-1 rounded-full">
            {formatINR(totalOutstanding)} Total Dues
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-4">
        {/* Multi-segment Progress Bar */}
        <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden flex shadow-inner">
          {buckets.map((b, idx) => {
            if (b.percentageOfTotal <= 0) return null
            return (
              <div
                key={b.rangeLabel}
                style={{ width: `${b.percentageOfTotal}%` }}
                className={`${getBucketColor(idx).split(' ')[0]} transition-all`}
                title={`${b.rangeLabel}: ${b.percentageOfTotal}% (${formatINR(b.totalAmount)})`}
              />
            )
          })}
        </div>

        {/* Bucket Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {buckets.map((b, idx) => (
            <div
              key={b.rangeLabel}
              className={`p-3 rounded-2xl border space-y-1 ${getBucketBorder(idx)}`}
            >
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-slate-700">{b.rangeLabel}</span>
                <span className="text-slate-500 font-mono">{b.percentageOfTotal}%</span>
              </div>
              <p className="text-sm font-black text-slate-900">{formatINR(b.totalAmount)}</p>
              <p className="text-[10px] text-slate-500 font-medium">
                {b.entriesCount} ledger entr{b.entriesCount === 1 ? 'y' : 'ies'}
              </p>
            </div>
          ))}
        </div>

        {/* Clarification Note */}
        <div className="flex items-start space-x-2 text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
          <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
          <span>
            Aging reflects days since the credit entry date in the shop notebook. Dues are not marked overdue unless a verified due date is set.
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
