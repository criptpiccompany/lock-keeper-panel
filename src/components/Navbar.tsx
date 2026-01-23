import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useStore } from "@/store/useStore";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Monitor,
  User,
  Book,
  FileText,
  Settings,
  Users,
} from "lucide-react";

const navItems = [
  { path: "/", label: "Telão", icon: Monitor },
  { path: "/meu", label: "Meu Painel", icon: User },
  { path: "/diretorio", label: "Diretório", icon: Book },
  { path: "/auditoria", label: "Auditoria", icon: FileText },
];

const adminItems = [
  { path: "/admin", label: "Admin", icon: Settings },
];

export function Navbar() {
  const location = useLocation();
  const { currentUser, users, setCurrentUser } = useStore();

  const handleUserChange = (userId: string) => {
    const user = users.find((u) => u.id === userId);
    if (user) {
      setCurrentUser(user);
    }
  };

  return (
    <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
            <Monitor className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg tracking-tight">InfluBoard</span>
        </Link>

        {/* Navigation Links */}
        <div className="flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden md:inline">{item.label}</span>
              </Link>
            );
          })}
          
          {/* Admin link - only show if admin */}
          {currentUser.role === "ADMIN" &&
            adminItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-warning text-warning-foreground"
                      : "text-warning/80 hover:text-warning hover:bg-warning/10"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden md:inline">{item.label}</span>
                </Link>
              );
            })}
        </div>

        {/* User Selector (for demo purposes) */}
        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className={cn(
              "text-xs",
              currentUser.role === "ADMIN" ? "border-warning text-warning" : "border-primary text-primary"
            )}
          >
            {currentUser.role}
          </Badge>
          
          <Select value={currentUser.id} onValueChange={handleUserChange}>
            <SelectTrigger className="w-[180px]">
              <Users className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  <div className="flex items-center gap-2">
                    <span>{user.nome}</span>
                    <Badge variant="secondary" className="text-xs">
                      {user.role}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </nav>
  );
}
