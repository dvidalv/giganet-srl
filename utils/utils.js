
import bcrypt from "bcryptjs";
import User from "@/app/models/user";

export const passwordHash = (password) => {
    return bcrypt.hashSync(password, 10);
}

export const passwordCompare = (password, hashedPassword) => {
    return bcrypt.compareSync(password, hashedPassword);
}

export async function checkAdminExists() {
    try {
        // Buscar si existe al menos un usuario con rol de admin
        const adminUser = await User.findOne({ role: 'admin' });
        
        if (adminUser) {
            console.log("✅ Usuario admin encontrado:", {
                email: adminUser.email,
                name: adminUser.name,
                createdAt: adminUser.createdAt
            });
            return true;
        } else {
            console.log("⚠️ No se encontró ningún usuario con rol de admin");
            return false;
        }
    } catch (error) {
        console.error("❌ Error al buscar usuario admin:", error.message);
        return false;
    }
}

export const getLocation = async (setLocationStatus) => {
	try {
		const position = await new Promise((resolve, reject) => {
			navigator.geolocation.getCurrentPosition(resolve, reject);
		});
		const { latitude, longitude } = position.coords;

		// Obtener el nombre de la ciudad usando Nominatim
		const response = await fetch(
			`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
		);
		const data = await response.json();
		const city = data.address.city || data.address.town || data.address.village;

		setLocationStatus(`Ubicación: ${city}`);
	} catch (error) {
		console.log(error.message);         
		setLocationStatus('Error al obtener la ubicación');
	}
};

