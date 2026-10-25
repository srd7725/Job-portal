import { Navigate } from "react-router-dom";
import { useSelector } from "react-redux";

const SuperAdminRoute = ({ children }) => {
    const { user } = useSelector((store) => store.auth);
    return user?.role === "superadmin" ? children : <Navigate to="/" replace />;
};

export default SuperAdminRoute;
