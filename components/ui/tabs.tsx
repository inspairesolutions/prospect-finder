'use client'

import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '@/lib/utils'

export const Tabs = TabsPrimitive.Root

interface TabsListProps extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> {
  actions?: React.ReactNode
}

export function TabsList({ className, children, actions, ...props }: TabsListProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <TabsPrimitive.List
        className={cn('inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1', className)}
        {...props}
      >
        {children}
      </TabsPrimitive.List>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  )
}

interface TabsTriggerProps extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> {
  badge?: React.ReactNode
}

export function TabsTrigger({ className, children, badge, ...props }: TabsTriggerProps) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors',
        'data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300',
        className
      )}
      {...props}
    >
      {children}
      {badge ? (
        <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-xs text-slate-700">{badge}</span>
      ) : null}
    </TabsPrimitive.Trigger>
  )
}

export function TabsContent({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn('mt-4', className)} {...props} />
}
