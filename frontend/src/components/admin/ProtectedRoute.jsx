import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";

const ProtectedRoute = ({children}) => {
    const {user} = useSelector(store=>store.auth);

    return user?.role === "recruiter" ? children : <Navigate to="/" replace />;
};
export default ProtectedRoute;