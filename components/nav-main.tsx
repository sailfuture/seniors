"use client"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
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
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon, SquareLock02Icon } from "@hugeicons/core-free-icons"

type NavItem = {
  title: string
  url: string
  icon: React.ReactNode
  isActive?: boolean
  separatorBefore?: boolean
  items?: {
    title: string
    url: string
    badge?: number
    badgeRed?: number
    badgeGray?: number
    isLocked?: boolean
  }[]
}

function NavCollapsibleItem({ item, pathname }: { item: NavItem; pathname: string }) {
  const [open, setOpen] = useState(item.isActive ?? false)

  useEffect(() => {
    if (item.isActive) setOpen(true)
    else setOpen(false)
  }, [item.isActive])

  return (
    <Collapsible asChild open={open} onOpenChange={setOpen}>
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
                {item.items?.map((subItem) => {
                  const isActive = pathname === subItem.url || pathname.startsWith(subItem.url + "/")
                  return (
                    <SidebarMenuSubItem key={subItem.title}>
                      {subItem.isLocked ? (
                        <SidebarMenuSubButton className="pointer-events-none opacity-50">
                          <span className="flex-1">{subItem.title}</span>
                          <HugeiconsIcon icon={SquareLock02Icon} strokeWidth={1.5} className="text-muted-foreground ml-auto size-3.5 shrink-0" />
                        </SidebarMenuSubButton>
                      ) : (
                        <SidebarMenuSubButton asChild className={isActive ? "bg-muted font-semibold" : ""}>
                          <Link href={subItem.url}>
                            <span className="flex-1">{subItem.title}</span>
                            {((subItem.badgeRed != null && subItem.badgeRed > 0) || (subItem.badge != null && subItem.badge > 0) || (subItem.badgeGray != null && subItem.badgeGray > 0)) && (
                              <span className="ml-auto flex shrink-0 items-center gap-1">
                                {subItem.badgeRed != null && subItem.badgeRed > 0 && (
                                  <span className="flex size-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white">
                                    {subItem.badgeRed}
                                  </span>
                                )}
                                {subItem.badgeGray != null && subItem.badgeGray > 0 && (
                                  <span className="flex size-4 items-center justify-center rounded-full bg-blue-500 text-[10px] font-medium text-white">
                                    {subItem.badgeGray}
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
                      )}
                    </SidebarMenuSubItem>
                  )
                })}
              </SidebarMenuSub>
            </CollapsibleContent>
          </>
        ) : null}
      </SidebarMenuItem>
    </Collapsible>
  )
}

export function NavMain({
  items,
  hideLabel,
}: {
  items: NavItem[]
  hideLabel?: boolean
}) {
  const pathname = usePathname()

  return (
    <SidebarGroup>
      {!hideLabel && <SidebarGroupLabel>Navigation</SidebarGroupLabel>}
      <SidebarMenu>
        {items.map((item) => (
          <div key={item.title}>
            {item.separatorBefore && <SidebarSeparator className="my-2" />}
            <NavCollapsibleItem item={item} pathname={pathname} />
          </div>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
