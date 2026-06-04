import Link from 'next/link';
import {
	IoLocationOutline,
	IoMailOutline,
	IoCallOutline,
	IoLogoFacebook,
	IoLogoInstagram,
	IoLogoWhatsapp
} from 'react-icons/io5';
import Image from 'next/image';
import './Footer.css';
import logo from "@/public/logo.png";

function Footer() {

	return (
		<footer className="footer_modern">
			<div className="contenedor footer_container">
				{/* Column 1: Brand & About */}
				<div className="footer_column brand_column">
					<Image 
						src={logo} 
						alt="Giganet Logo" 
						width={170} 
						height={70} 
						style={{ width: 'auto', height: 'auto' }}
						className="footer_logo" 
						priority
						loading="eager"
					/>
					<p className="footer_description">
						Desarrollamos soluciones tecnológicas a tu medida. 
						Software personalizado y servicios de desarrollo para empresas y particulares.
					</p>
					<div className="footer_socials">
						<a href="https://facebook.com" target="_blank" rel="noopener noreferrer" aria-label="Facebook"><IoLogoFacebook /></a>
						<a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram"><IoLogoInstagram /></a>
						<a href="https://wa.me/6825602093" target="_blank" rel="noopener noreferrer" aria-label="Whatsapp"><IoLogoWhatsapp /></a>
					</div>
				</div>

				{/* Column 2: Quick Links */}
				<div className="footer_column links_column">
					<h3>Navegación</h3>
					<ul className="footer_links">
						<li><Link href="/#hero">Inicio</Link></li>
						<li><Link href="/#servicios">Servicios</Link></li>
						<li><Link href="/#clientes">Clientes</Link></li>
						<li><Link href="/dashboard">Dashboard</Link></li>
						<li><Link href="/login">Login</Link></li>
					</ul>
				</div>

				{/* Column 3: Contact Info (Existing improved) */}
				<div className="footer_column contact_column">
					<h3>Contáctanos</h3>
					<div className="contact_item">
						<IoLocationOutline className="contact_icon" />
						<div>
							<p className="contact_label">Dirección</p>
							<a 
								href="https://maps.app.goo.gl/XwcVqy64qceAJigcA" 
								target="_blank" 
								rel="noopener noreferrer"
								className="contact_text"
							>
								Calle 4 N. 16, Las Carolinas<br />
								La Vega, República Dominicana
							</a>
						</div>
					</div>
					
					<div className="contact_item">
						<IoCallOutline className="contact_icon" />
						<div>
							<p className="contact_label">Teléfonos</p>
						<div className="phone_links">
							<a href="https://wa.me/18298890579" target="_blank" rel="noopener noreferrer" className="contact_text">829-889-0579 <IoLogoWhatsapp /></a>
							<a href="https://wa.me/16825602093" target="_blank" rel="noopener noreferrer" className="contact_text">682-560-2093 <IoLogoWhatsapp /></a>
						</div>
						</div>
					</div>

					<div className="contact_item">
						<IoMailOutline className="contact_icon" />
						<div>
							<p className="contact_label">Email</p>
							<a href="mailto:dvidalv@giganet-srl.com" className="contact_text">dvidalv@giganet-srl.com</a>
						</div>
					</div>
				</div>
			</div>

			<div className="footer_bottom">
				<div className="contenedor">
					<p>&copy; {new Date().getFullYear()} Giganet S.R.L. Todos los derechos reservados.</p>
				</div>
			</div>
		</footer>
	);
}

export default Footer;
