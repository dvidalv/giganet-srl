import bcrypt from "bcryptjs";
export const passwordHash = (password) => {
    return bcrypt.hashSync(password, 10);
}

export const passwordCompare = (password, hashedPassword) => {
    return bcrypt.compareSync(password, hashedPassword);
}