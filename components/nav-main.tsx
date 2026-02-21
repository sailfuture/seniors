"use client"

import Link from "next/link"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"

export function NavMain({
  items,
  hideLabel,
}: {
  items: {
    title: string
    url: string
    icon: React.ReactNode
    isActive?: boolean
    items?: {
      title: string
      url: string
      badge?: number
      badgeRed?: number
    }[]
  }[]
  hideLabel?: boolean
}) {
  return (
    <SidebarGroup>
      {!hideLabel && <SidebarGroupLabel>Navigation</SidebarGroupLabel>}
      <SidebarMenu>
        {items.map((item) => (
          <Collapsible key={item.title} asChild defaultOpen={item.isActive}>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip={item.title}>
                <Link href={item.url}>
                  {item.icon}
                  <span className="font-semibold">{item.title}</span>
                </Link>
              </SidebarMenuButton>
              {item.items?.length ? (
                <>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuAction className="data-[state=open]:rotate-90">
                      <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} />
                      <span className="sr-only">Toggle</span>
                    </SidebarMenuAction>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {item.items?.map((subItem) => (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton asChild>
                            <Link href={subItem.url}>
                              <span className="flex-1">{subItem.title}</span>
                              {((subItem.badgeRed != null && subItem.badgeRed > 0) || (subItem.badge != null && subItem.badge > 0)) && (
                                <span className="ml-auto flex shrink-0 items-center gap-1">
                                  {subItem.badgeRed != null && subItem.badgeRed > 0 && (
                                    <span className="flex size-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white">
                                      {subItem.badgeRed}
                                    </span>
                                  )}
                                  {subItem.badge != null && subItem.badge > 0 && (
                                    <span className="flex size-4 items-center justify-center rounded-full bg-blue-500 text-[10px] font-medium text-white">
                                      {subItem.badge}
                                    </span>
                                  )}
                                </span>
                              )}
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </>
              ) : null}
            </SidebarMenuItem>
          </Collapsible>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
