import styles from "./header.module.css";
import Link from "next/link";
import Image from "next/image";
import logo from "@/public/logo.png";
import { auth } from "@/auth";
import HeaderNav from "./HeaderNav";

export default async function Header() {
    const session = await auth();
    const isLoggedIn = !!session?.user;

    return (
        <header className={styles.header}>
            <div className={styles.logoContainer}>
                <Link href="/">
                    <Image src={logo} alt="Logo Giganet" width={120} height={60} className={styles.logo} priority loading="eager" />
                </Link>
            </div>
            <HeaderNav isLoggedIn={isLoggedIn} />
        </header>
    );
}
