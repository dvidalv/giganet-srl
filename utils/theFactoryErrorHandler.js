/**
 * Utilidad para normalizar y manejar errores de The Factory HKA.
 * Preserva toda la información de error.response.data y la estructura de forma consistente.
 */

/**
 * Normaliza errores de validación de The Factory.
 * @param {Object} errors - Objeto errors de la respuesta de The Factory
 * @returns {Array} Array de errores normalizados
 */
function normalizeValidationErrors(errors) {
  if (!errors || typeof errors !== 'object') {
    return [];
  }

  const normalized = [];

  for (const [fieldPath, messages] of Object.entries(errors)) {
    const messageArray = Array.isArray(messages) ? messages : [messages];

    for (const message of messageArray) {
      const messageStr = String(message || '');
      
      // Detectar formato "0102|El campo no cumple con el formato correcto"
      if (messageStr.includes('|')) {
        const [code, ...messageParts] = messageStr.split('|');
        normalized.push({
          field: fieldPath,
          code: code.trim(),
          message: messageParts.join('|').trim(),
        });
      } else {
        // Sin código, solo mensaje
        normalized.push({
          field: fieldPath,
          code: null,
          message: messageStr.trim(),
        });
      }
    }
  }

  return normalized;
}

/**
 * Traduce rutas técnicas de campos a lenguaje comprensible.
 * @param {string} fieldPath - Ruta técnica del campo
 * @returns {string} Traducción en español
 */
export function translateFieldPath(fieldPath) {
  if (!fieldPath) return 'campo desconocido';

  const translations = {
    // Comprador
    'DocumentoElectronico.Encabezado.Comprador.Correo': 'correo del comprador',
    'DocumentoElectronico.Encabezado.Comprador.RNC': 'RNC del comprador',
    'DocumentoElectronico.Encabezado.Comprador.RazonSocial': 'razón social del comprador',
    'DocumentoElectronico.Encabezado.Comprador.Direccion': 'dirección del comprador',
    'DocumentoElectronico.Encabezado.Comprador.Telefono': 'teléfono del comprador',
    
    // Emisor
    'DocumentoElectronico.Encabezado.Emisor.RNC': 'RNC del emisor',
    'DocumentoElectronico.Encabezado.Emisor.RazonSocial': 'razón social del emisor',
    'DocumentoElectronico.Encabezado.Emisor.Correo': 'correo del emisor',
    'DocumentoElectronico.Encabezado.Emisor.Direccion': 'dirección del emisor',
    'DocumentoElectronico.Encabezado.Emisor.Telefono': 'teléfono del emisor',
    
    // Factura
    'DocumentoElectronico.Encabezado.IdDoc.eNCF': 'número de comprobante (NCF)',
    'DocumentoElectronico.Encabezado.IdDoc.FechaEmision': 'fecha de emisión',
    'DocumentoElectronico.Encabezado.IdDoc.FechaVencimientoSecuencia': 'fecha de vencimiento de secuencia',
    'DocumentoElectronico.Encabezado.IdDoc.TipoIngresos': 'tipo de ingresos',
    
    // Totales
    'DocumentoElectronico.Encabezado.Totales.MontoTotal': 'monto total',
    'DocumentoElectronico.Encabezado.Totales.MontoGravado': 'monto gravado',
    'DocumentoElectronico.Encabezado.Totales.MontoExento': 'monto exento',
    'DocumentoElectronico.Encabezado.Totales.ITBIS': 'ITBIS',
    'DocumentoElectronico.Encabezado.Totales.TotalITBIS': 'total ITBIS',
    
    // Detalles
    'DocumentoElectronico.Detalle': 'detalle de la factura',
    'DocumentoElectronico.Detalle.Descripcion': 'descripción del item',
    'DocumentoElectronico.Detalle.Cantidad': 'cantidad del item',
    'DocumentoElectronico.Detalle.PrecioUnitario': 'precio unitario',
    
    // Forma de pago
    'DocumentoElectronico.Encabezado.OtraMoneda': 'otra moneda',
    'DocumentoElectronico.Encabezado.FormaPago': 'forma de pago',
  };

  // Buscar traducción exacta
  if (translations[fieldPath]) {
    return translations[fieldPath];
  }

  // Traducción inteligente basada en segmentos
  const segments = fieldPath.split('.');
  const lastSegment = segments[segments.length - 1];
  const secondLastSegment = segments[segments.length - 2];

  // Detectar contexto (Comprador, Emisor, etc.)
  let context = '';
  if (fieldPath.includes('.Comprador.')) {
    context = ' del comprador';
  } else if (fieldPath.includes('.Emisor.')) {
    context = ' del emisor';
  } else if (fieldPath.includes('.Totales.')) {
    context = ' en totales';
  } else if (fieldPath.includes('.Detalle.')) {
    context = ' en el detalle';
  }

  // Traducir el último segmento
  const segmentTranslations = {
    'Correo': 'correo',
    'RNC': 'RNC',
    'RazonSocial': 'razón social',
    'Direccion': 'dirección',
    'Telefono': 'teléfono',
    'FechaEmision': 'fecha de emisión',
    'FechaVencimientoSecuencia': 'fecha de vencimiento',
    'MontoTotal': 'monto total',
    'MontoGravado': 'monto gravado',
    'MontoExento': 'monto exento',
    'ITBIS': 'ITBIS',
    'Descripcion': 'descripción',
    'Cantidad': 'cantidad',
    'PrecioUnitario': 'precio unitario',
    'eNCF': 'NCF',
    'TipoIngresos': 'tipo de ingresos',
  };

  const translatedSegment = segmentTranslations[lastSegment] || lastSegment.toLowerCase();

  return `${translatedSegment}${context}`;
}

/**
 * Normaliza un error de Axios/Fetch de The Factory a una estructura consistente.
 * Preserva toda la información de error.response.data.
 * 
 * @param {Error} error - Error de Axios/Fetch
 * @returns {Object} Error normalizado
 */
export function normalizeTheFactoryError(error) {
  // Información base del error
  const normalized = {
    type: 'THE_FACTORY_ERROR',
    httpStatus: null,
    originalMessage: error.message || 'Error desconocido',
    timestamp: new Date().toISOString(),
  };

  // Si no hay response, es un error de red/timeout
  if (!error.response) {
    normalized.networkError = true;
    normalized.message = error.message;
    
    if (error.code === 'ECONNREFUSED') {
      normalized.type = 'THE_FACTORY_CONNECTION_REFUSED';
      normalized.message = 'El servidor de The Factory rechazó la conexión. El servidor puede estar caído o inaccesible.';
    } else if (error.code === 'ENOTFOUND') {
      normalized.type = 'THE_FACTORY_DNS_ERROR';
      normalized.message = 'No se puede resolver el dominio de The Factory. Verifica la configuración de DNS.';
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      normalized.type = 'THE_FACTORY_TIMEOUT';
      normalized.message = 'Timeout al conectar con The Factory. El servidor no respondió a tiempo.';
    } else if (error.code === 'ECONNRESET') {
      normalized.type = 'THE_FACTORY_CONNECTION_RESET';
      normalized.message = 'El servidor de The Factory cerró la conexión abruptamente. Puede estar sobrecargado o caído.';
    }
    
    return normalized;
  }

  // Extraer response.data (la información más importante)
  const responseData = error.response.data || {};
  normalized.httpStatus = error.response.status;
  normalized.rawResponseData = responseData;

  // Preservar toda la información de responseData
  if (responseData.type) normalized.errorType = responseData.type;
  if (responseData.title) normalized.title = responseData.title;
  if (responseData.status) normalized.apiStatus = responseData.status;
  if (responseData.traceId) normalized.traceId = responseData.traceId;
  if (responseData.codigo !== undefined) normalized.codigo = responseData.codigo;
  if (responseData.mensaje) normalized.mensaje = responseData.mensaje;
  if (responseData.procesado !== undefined) normalized.procesado = responseData.procesado;
  if (responseData.codigoSeguridad) normalized.codigoSeguridad = responseData.codigoSeguridad;
  if (responseData.observaciones) normalized.observaciones = responseData.observaciones;

  // Caso especial: errores de validación estructurados
  if (responseData.errors && typeof responseData.errors === 'object') {
    normalized.type = 'THE_FACTORY_VALIDATION_ERROR';
    normalized.validationErrors = normalizeValidationErrors(responseData.errors);
    
    // Generar mensaje resumido
    const errorCount = normalized.validationErrors.length;
    if (errorCount === 1) {
      const err = normalized.validationErrors[0];
      normalized.message = `Error de validación en ${translateFieldPath(err.field)}: ${err.message}`;
    } else if (errorCount > 1) {
      normalized.message = `Se encontraron ${errorCount} errores de validación en el comprobante.`;
    } else {
      normalized.message = responseData.title || 'Error de validación en el comprobante.';
    }
  }
  // Caso: error con código y mensaje de The Factory (formato antiguo)
  else if (responseData.codigo !== undefined) {
    normalized.type = 'THE_FACTORY_BUSINESS_ERROR';
    
    // Códigos conocidos de The Factory
    const knownErrorMessages = {
      108: 'NCF ya fue presentado anteriormente',
      109: 'NCF vencido o inválido',
      110: 'RNC no autorizado para este tipo de comprobante',
      111: 'Datos de la factura inválidos',
      120: 'Documento no encontrado en The Factory',
      7777: 'Secuencia reutilizable (problema de postulación o rango e-NCF)',
    };

    normalized.message = responseData.mensaje || 
                        knownErrorMessages[responseData.codigo] || 
                        `Error ${responseData.codigo} de The Factory`;
  }
  // Caso: respuesta con texto plano o mensaje simple
  else if (responseData.mensaje) {
    normalized.type = 'THE_FACTORY_BUSINESS_ERROR';
    normalized.message = responseData.mensaje;
  }
  // Caso: objeto genérico sin estructura conocida
  else if (typeof responseData === 'object' && Object.keys(responseData).length > 0) {
    normalized.message = JSON.stringify(responseData);
  }
  // Fallback: usar el mensaje del error HTTP
  else {
    normalized.message = `Error HTTP ${normalized.httpStatus} de The Factory`;
  }

  return normalized;
}

/**
 * Construye un texto estructurado para enviar a la IA.
 * Preserva toda la información del error normalizado.
 * 
 * @param {Object} normalizedError - Error normalizado
 * @returns {string} Texto estructurado para la IA
 */
export function buildErrorTextForAI(normalizedError) {
  const parts = [];

  parts.push('=== ERROR DE THE FACTORY HKA ===');
  parts.push('');

  // Tipo de error
  parts.push(`Tipo: ${normalizedError.type}`);
  
  // Status HTTP
  if (normalizedError.httpStatus) {
    parts.push(`HTTP Status: ${normalizedError.httpStatus}`);
  }

  // Código de The Factory
  if (normalizedError.codigo !== undefined) {
    parts.push(`Código The Factory: ${normalizedError.codigo}`);
  }

  // Título
  if (normalizedError.title) {
    parts.push(`Título: ${normalizedError.title}`);
  }

  // Mensaje principal
  parts.push(`Mensaje: ${normalizedError.message}`);

  // Errores de validación detallados
  if (normalizedError.validationErrors && normalizedError.validationErrors.length > 0) {
    parts.push('');
    parts.push('Errores de validación:');
    normalizedError.validationErrors.forEach((err, index) => {
      parts.push(`${index + 1}. Campo: ${err.field}`);
      parts.push(`   Traducción: ${translateFieldPath(err.field)}`);
      if (err.code) {
        parts.push(`   Código: ${err.code}`);
      }
      parts.push(`   Mensaje: ${err.message}`);
    });
  }

  // Observaciones (si existen)
  if (normalizedError.observaciones && Array.isArray(normalizedError.observaciones)) {
    parts.push('');
    parts.push('Observaciones:');
    normalizedError.observaciones.forEach((obs, index) => {
      parts.push(`${index + 1}. ${JSON.stringify(obs)}`);
    });
  }

  // TraceId para debugging
  if (normalizedError.traceId) {
    parts.push('');
    parts.push(`TraceId: ${normalizedError.traceId}`);
  }

  // Timestamp
  parts.push('');
  parts.push(`Timestamp: ${normalizedError.timestamp}`);

  return parts.join('\n');
}

/**
 * Logs de desarrollo para debugging.
 * Solo se muestran en desarrollo o cuando NODE_ENV no es production.
 * 
 * @param {Error} error - Error original
 * @param {Object} normalized - Error normalizado
 */
export function logTheFactoryError(error, normalized) {
  if (process.env.NODE_ENV === 'production') {
    // En producción, solo log básico sin información sensible
    console.error('[TheFactory] Error:', {
      type: normalized.type,
      httpStatus: normalized.httpStatus,
      codigo: normalized.codigo,
      message: normalized.message,
    });
    return;
  }

  // En desarrollo, log completo
  console.error('');
  console.error('='.repeat(80));
  console.error('THE FACTORY ERROR - INFORMACIÓN COMPLETA');
  console.error('='.repeat(80));
  console.error('');
  console.error('ERROR ORIGINAL:');
  console.error('  Mensaje:', error.message);
  console.error('  Code:', error.code);
  console.error('');
  
  if (error.response) {
    console.error('RESPONSE DATA (RAW):');
    console.error(JSON.stringify(error.response.data, null, 2));
    console.error('');
  }

  console.error('ERROR NORMALIZADO:');
  console.error(JSON.stringify(normalized, null, 2));
  console.error('');
  console.error('TEXTO PARA IA:');
  console.error(buildErrorTextForAI(normalized));
  console.error('');
  console.error('='.repeat(80));
  console.error('');
}
