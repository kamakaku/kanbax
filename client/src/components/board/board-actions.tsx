import { useAuth } from "@/lib/auth-store";
import { apiRequest } from "@/lib/api-request";

export function BoardActions() {
  const { user } = useAuth();
  
  const createBoard = async (boardData: any) => {
    try {
      const response = await apiRequest(
        "POST", 
        "/api/boards", 
        boardData,
        user?.id // Pass the user ID from auth store
      );
      // Rest of the function...
    } catch (error) {
      console.error("Failed to create board:", error);
    }
  };
  
  // Rest of the component...
}
