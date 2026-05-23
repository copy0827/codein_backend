import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';

export interface NavDropdownItem {
  to: string;
  label: string;
}

interface NavDropdownProps {
  label: string;
  items: NavDropdownItem[];
}

const NavDropdown: React.FC<NavDropdownProps> = ({ label, items }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const location = useLocation();

  const isActive = items.some(
    (item) =>
      location.pathname === item.to ||
      location.pathname.startsWith(`${item.to}/`),
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`nav-item inline-flex items-center gap-1 text-sm font-medium transition-colors px-2.5 py-2 rounded-xl hover:bg-dark-nav ${
          isActive ? 'text-brand' : 'text-dark-muted hover:text-dark-text'
        }`}
        aria-expanded={open}
        aria-haspopup="true"
      >
        {label}
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[9.5rem] rounded-xl border border-dark-line bg-dark-bg py-1 shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive: active }) =>
                `block px-3.5 py-2 text-sm transition-colors ${
                  active
                    ? 'bg-brand/10 font-semibold text-brand'
                    : 'text-dark-muted hover:bg-dark-nav hover:text-dark-text'
                }`
              }
              onClick={() => setOpen(false)}
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
};

export default NavDropdown;
