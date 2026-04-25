import { NavLink, Outlet } from "react-router";
import logoSrc from "../../public/favicon.ico";
import { useState } from "react";
import { ProjectsIcon, ReposIcon } from "~/common/icons";


const NAV_ITEMS = [
  { to: "/repos", label: "Repos", Icon: ReposIcon },
  { to: "/projects", label: "Projects", Icon: ProjectsIcon },
];

export default function SidebarLayout() {
  const [open, setOpen] = useState(true);

  return (
    <div className="h-screen w-full flex bg-gray-950">
      {/* Sidebar */}
      <div
        className={`relative flex flex-col h-screen border-r border-gray-800 bg-gray-950 transition-[width] duration-200 shrink-0 ${
          open ? "w-52" : "w-16"
        }`}
      >
        {/* Toggle button */}
        <button
          onClick={() => setOpen((p) => !p)}
          className="absolute top-1/2 -translate-y-1/2 -right-3 z-20 size-9 flex items-center justify-center bg-gray-950 border border-gray-700 rounded-md hover:bg-gray-800 transition-colors"
          aria-label={open ? "Collapse sidebar" : "Expand sidebar"}
        >
          <svg
            className={`size-5 text-gray-400 transition-transform duration-200 ${
              open ? "rotate-180" : "rotate-0"
            }`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>

        {/* Logo */}
        <div className="flex items-center h-14 px-4 border-b border-gray-800 shrink-0 gap-3">
          <img src={logoSrc} alt="Virgo Logo" className="size-7 shrink-0" />
          <span
            className={`text-sm font-semibold tracking-wide text-gray-100 whitespace-nowrap transition-[opacity,max-width] duration-200 overflow-hidden ${
              open ? "opacity-100 max-w-xs" : "opacity-0 max-w-0"
            }`}
          >
            Virgo
          </span>
        </div>

        {/* Nav items */}
        <nav className="flex flex-col gap-1 px-2 pt-3 flex-1">
          {NAV_ITEMS.map(({ to, label, Icon }) => (
            <div key={to} className="relative group">
              <NavLink
                to={to}
                className={({ isActive }) =>
                  `flex items-center px-3 py-2 rounded-lg transition-colors text-sm font-medium ${
                    open ? "gap-3" : "justify-center"
                  } ${
                    isActive
                      ? "bg-gray-800 text-white"
                      : "text-gray-400 hover:bg-gray-800/50 hover:text-gray-200"
                  }`
                }
              >
                <Icon />
                {open && <span className="whitespace-nowrap">{label}</span>}
              </NavLink>

              {/* Right-side tooltip when collapsed */}
              {!open && (
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-gray-800 border border-gray-700 text-gray-100 text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                  {label}
                </div>
              )}
            </div>
          ))}
        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}
