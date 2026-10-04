import React, { useState } from 'react'
import { FinancialTrendPoint } from '@/services/analyticsService'
import { formatINR } from '@/lib/utils'

interface FinancialTrendChartProps {
  data: FinancialTrendPoint[]
  height?: number
}

export const FinancialTrendChart: React.FC<FinancialTrendChartProps> = ({
  data,
  height = 240,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  if (!data || data.length === 0) {
    return (
      <div className="h-60 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
        <p className="text-xs font-semibold">No transaction trends in selected date range.</p>
        <p className="text-[11px] text-slate-400 mt-0.5">Try selecting a broader date filter.</p>
      </div>
    )
  }

  // Find max value across all series for Y-axis scale
  const maxVal = Math.max(
    ...data.map((d) =>
      Math.max(d.ledgerCreditAmount, d.importedPaymentAmount, d.confirmedMatchedAmount)
    ),
    100
  )

  const paddingLeft = 55
  const paddingRight = 20
  const paddingTop = 25
  const paddingBottom = 35
  const chartWidth = 700
  const chartHeight = height
  const plotWidth = chartWidth - paddingLeft - paddingRight
  const plotHeight = chartHeight - paddingTop - paddingBottom

  const barGroupWidth = plotWidth / data.length
  const singleBarWidth = Math.max(3, Math.min(14, (barGroupWidth - 8) / 3))

  // Y-axis tick values (4 steps)
  const yTicks = [0, maxVal * 0.33, maxVal * 0.66, maxVal]

  return (
    <div className="space-y-3">
      {/* Legend */}
      <div className="flex flex-wrap items-center justify-end gap-4 text-xs font-bold px-2">
        <div className="flex items-center space-x-1.5">
          <span className="w-3 h-3 rounded-md bg-emerald-500"></span>
          <span className="text-slate-600">Ledger Credit Due</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-3 h-3 rounded-md bg-teal-500"></span>
          <span className="text-slate-600">Imported UPI Payments</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-3 h-3 rounded-md bg-purple-600"></span>
          <span className="text-slate-600">Confirmed Reconciled</span>
        </div>
      </div>

      {/* SVG Chart */}
      <div className="relative overflow-x-auto">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-auto min-w-[550px] select-none"
        >
          {/* Grid lines & Y-axis labels */}
          {yTicks.map((tick, i) => {
            const yPos = paddingTop + plotHeight - (tick / maxVal) * plotHeight
            return (
              <g key={i}>
                <line
                  x1={paddingLeft}
                  y1={yPos}
                  x2={chartWidth - paddingRight}
                  y2={yPos}
                  stroke="#E2E8F0"
                  strokeDasharray={i === 0 ? '0' : '4 4'}
                  strokeWidth="1"
                />
                <text
                  x={paddingLeft - 8}
                  y={yPos + 4}
                  textAnchor="end"
                  className="text-[10px] fill-slate-400 font-mono font-medium"
                >
                  {tick >= 1000 ? `₹${(tick / 1000).toFixed(0)}k` : `₹${Math.round(tick)}`}
                </text>
              </g>
            )
          })}

          {/* Grouped Bars */}
          {data.map((point, idx) => {
            const groupX = paddingLeft + idx * barGroupWidth
            const centerX = groupX + barGroupWidth / 2

            const hLedger = (point.ledgerCreditAmount / maxVal) * plotHeight
            const hImported = (point.importedPaymentAmount / maxVal) * plotHeight
            const hConfirmed = (point.confirmedMatchedAmount / maxVal) * plotHeight

            const isHovered = hoveredIndex === idx

            return (
              <g
                key={point.periodKey}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                className="cursor-pointer"
              >
                {/* Background Hover Highlight */}
                {isHovered && (
                  <rect
                    x={groupX + 2}
                    y={paddingTop}
                    width={barGroupWidth - 4}
                    height={plotHeight}
                    fill="#F1F5F9"
                    opacity="0.6"
                    rx="6"
                  />
                )}

                {/* 1. Ledger Credit Bar (Emerald) */}
                <rect
                  x={centerX - singleBarWidth * 1.6}
                  y={paddingTop + plotHeight - hLedger}
                  width={singleBarWidth}
                  height={Math.max(1, hLedger)}
                  fill="#10B981"
                  rx="3"
                  className="transition-all hover:brightness-110"
                />

                {/* 2. Imported UPI Payment Bar (Teal) */}
                <rect
                  x={centerX - singleBarWidth * 0.5}
                  y={paddingTop + plotHeight - hImported}
                  width={singleBarWidth}
                  height={Math.max(1, hImported)}
                  fill="#14B8A6"
                  rx="3"
                  className="transition-all hover:brightness-110"
                />

                {/* 3. Confirmed Matched Bar (Purple) */}
                <rect
                  x={centerX + singleBarWidth * 0.6}
                  y={paddingTop + plotHeight - hConfirmed}
                  width={singleBarWidth}
                  height={Math.max(1, hConfirmed)}
                  fill="#9333EA"
                  rx="3"
                  className="transition-all hover:brightness-110"
                />

                {/* X-axis Label (Show every Nth label if dense) */}
                {(data.length <= 12 || idx % Math.ceil(data.length / 10) === 0) && (
                  <text
                    x={centerX}
                    y={chartHeight - 10}
                    textAnchor="middle"
                    className="text-[10px] fill-slate-500 font-bold"
                  >
                    {point.label}
                  </text>
                )}
              </g>
            )
          })}
        </svg>

        {/* Floating Tooltip when hovered */}
        {hoveredIndex !== null && data[hoveredIndex] && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-sm text-white px-4 py-2.5 rounded-2xl shadow-xl text-xs space-y-1 z-20 pointer-events-none border border-slate-700">
            <p className="font-extrabold text-emerald-400 border-b border-slate-700 pb-1">
              {data[hoveredIndex].label}
            </p>
            <div className="grid grid-cols-3 gap-3 text-[11px] pt-0.5">
              <div>
                <span className="text-slate-400 block text-[9px] uppercase">Ledger Credit</span>
                <span className="font-bold text-emerald-300">
                  {formatINR(data[hoveredIndex].ledgerCreditAmount)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[9px] uppercase">UPI Payments</span>
                <span className="font-bold text-teal-300">
                  {formatINR(data[hoveredIndex].importedPaymentAmount)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[9px] uppercase">Confirmed Matched</span>
                <span className="font-bold text-purple-300">
                  {formatINR(data[hoveredIndex].confirmedMatchedAmount)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
