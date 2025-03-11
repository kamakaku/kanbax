import { Menu, LayoutDashboard, ScrollText, MenuSquare, LayoutGrid, User, LogOut, Settings, ListTodo } from "lucide-react";
// ... rest of the imports ...

// ... other code ...

<DropdownMenuItem onClick={() => navigate("/boards")}>
  <LayoutGrid className="w-4 h-4 mr-2" />
  <span>Alle Boards</span>
</DropdownMenuItem>
<DropdownMenuItem onClick={() => navigate("/tasks")}>
  <ListTodo className="w-4 h-4 mr-2" />
  <span>Alle Aufgaben</span>
</DropdownMenuItem>

// ... rest of the code ...