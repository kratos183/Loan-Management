import {
  LayoutDashboard,
  FilePlus2,
  FileText,
  Landmark,
  Calculator,
  Gauge,
  Receipt,
  MessagesSquare,
  Inbox,
  Users,
  Package,
  BarChart3,
  ScrollText,
  LifeBuoy,
  Ticket,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Show a live count badge resolved at render time. */
  badgeKey?: "pendingApplications" | "openTickets" | "unreadNotifications" | "overdueEmis";
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

/**
 * Source doc line 8 defines the seven user-portal destinations.
 * Line 4 defines the three portals.
 */
export const USER_NAV: NavSection[] = [
  {
    title: "Overview",
    items: [{ href: "/user/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Borrowing",
    items: [
      { href: "/user/new-loan", label: "New Loan", icon: FilePlus2 },
      { href: "/user/applications", label: "Application Status", icon: FileText },
      { href: "/user/loans", label: "Current Loan Status", icon: Landmark },
    ],
  },
  {
    title: "Tools",
    items: [
      { href: "/user/emi-calculator", label: "EMI Calculator", icon: Calculator },
      { href: "/user/cibil", label: "CIBIL Score", icon: Gauge },
      { href: "/user/payments", label: "Payment History", icon: Receipt },
    ],
  },
  {
    title: "Support",
    items: [
      { href: "/user/chat", label: "Chatbot & Chat", icon: MessagesSquare, badgeKey: "unreadNotifications" },
      { href: "/user/tickets", label: "Raise a Ticket", icon: LifeBuoy, badgeKey: "openTickets" },
    ],
  },
];

export const EMPLOYEE_NAV: NavSection[] = [
  {
    title: "Overview",
    items: [{ href: "/employee/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Work queue",
    items: [
      {
        href: "/employee/applications",
        label: "Applications",
        icon: Inbox,
        badgeKey: "pendingApplications",
      },
      { href: "/employee/chat", label: "Chats", icon: MessagesSquare, badgeKey: "unreadNotifications" },
      { href: "/employee/tickets", label: "Tickets", icon: Ticket, badgeKey: "openTickets" },
    ],
  },
  {
    title: "Servicing",
    items: [
      { href: "/employee/loans", label: "Loans & EMIs", icon: Landmark, badgeKey: "overdueEmis" },
      { href: "/employee/noc", label: "NOC Requests", icon: ScrollText },
    ],
  },
];

export const ADMIN_NAV: NavSection[] = [
  {
    title: "Overview",
    items: [{ href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Administration",
    items: [
      // GAP 1: admin portal scope = user management + product config + reports
      { href: "/admin/users", label: "User Management", icon: Users },
      { href: "/admin/products", label: "Product Config", icon: Package },
      { href: "/admin/staff", label: "Staff & Authority", icon: ScrollText },
    ],
  },
  {
    title: "Insight",
    items: [
      { href: "/admin/reports", label: "Reports", icon: BarChart3 },
      { href: "/admin/audit", label: "Audit Log", icon: ScrollText },
    ],
  },
];

export const NAV_BY_PORTAL = {
  user: USER_NAV,
  employee: EMPLOYEE_NAV,
  admin: ADMIN_NAV,
} as const;

export const PORTAL_LABEL = {
  user: "User Portal",
  employee: "Employee Portal",
  admin: "Admin Portal",
} as const;