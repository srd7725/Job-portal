import { Navigate } from "react-router-dom";
import { useSelector } from "react-redux";

const StudentRoute = ({ children }) => {
    const { user } = useSelector((store) => store.auth);
    return user?.role === "student" ? children : <Navigate to="/" replace />;
};

export default StudentRoute;
