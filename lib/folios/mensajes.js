/** Respuestas de bloqueo de emisión, con la misma forma que los demás errores de enviar-factura. */
export const BLOQUEOS_FOLIOS = {
  FOLIOS_VENCIDOS: {
    httpStatus: 403,
    message:
      "Su paquete de folios electrónicos ha vencido. Contacte a su proveedor de servicio para renovar su contrato",
  },
  FOLIOS_AGOTADOS: {
    httpStatus: 403,
    message:
      "Ha consumido la totalidad de sus folios electrónicos disponibles. Contacte a su proveedor de servicio para adquirir un nuevo paquete",
  },
  FOLIOS_SIN_CONTRATO_VIGENTE: {
    httpStatus: 403,
    message:
      "Su paquete de folios electrónicos aún no está vigente. Contacte a su proveedor de servicio",
  },
  FOLIOS_CONFIGURACION_INCOMPLETA: {
    httpStatus: 403,
    message:
      "La configuración de folios electrónicos de su empresa está incompleta. Contacte a su proveedor de servicio",
  },
  FOLIO_EN_PROCESO: {
    httpStatus: 409,
    message:
      "Este comprobante ya se está enviando. Espere unos segundos y consulte su estatus antes de reintentar",
  },
  FOLIO_NCF_REQUERIDO: {
    httpStatus: 400,
    message: "Debe proporcionar factura.ncf para emitir el comprobante",
  },
};

export const ETIQUETAS_ESTADO = {
  ILIMITADO: "Ilimitado",
  SIN_CONTRATO: "Configuración incompleta",
  PROGRAMADO: "Programado",
  VIGENTE: "Vigente",
  POR_VENCER: "Por vencer",
  SIN_SALDO_ASIGNADO: "Sin saldo asignado",
  AGOTADO: "Agotado",
  VENCIDO: "Vencido",
  CANCELADO: "Cancelado",
};

export const MENSAJES_ALERTA = {
  VENCE_30: "El contrato de folios vence en 30 días o menos",
  VENCE_15: "El contrato de folios vence en 15 días o menos",
  VENCE_7: "El contrato de folios vence en 7 días o menos",
  VENCIDO: "El contrato de folios ha vencido",
  CONSUMO_80: "Se ha consumido el 80 % de los folios contratados",
  CONSUMO_100: "Se ha consumido el 100 % de los folios contratados",
  MINIMO: "Los folios disponibles alcanzaron el mínimo configurado",
};
