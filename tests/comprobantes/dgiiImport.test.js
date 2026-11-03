import { describe, it, expect } from "vitest";
import {
  parseNcfE,
  parseCantidadAprobada,
  normalizarFechaDia,
  normalizarFilaExtraida,
  validarFilaParaCrear,
  claveDedupSolicitud,
  deduplicarFilasPorSolicitud,
  fusionarExtraccionesPorImagen,
  enriquecerFilaConSolicitudAutorizacion,
  parseSolicitudAutorizacionDesdeComentario,
  encontrarSolapeConExistentes,
  rangosSeSolapan,
  preferirFilaMasCompleta,
  colapsarPorTipoYRangoSolapado,
  debenColapsarPorRangoSolapado,
  filaTipoCoincideConNcf,
} from "@/lib/comprobantes/dgiiImport";

describe("dgiiImport helpers", () => {
  it("parsea NCF E y rechaza B", () => {
    expect(parseNcfE("E31000000001")).toEqual({
      tipo: "31",
      numero: 1,
      ncf: "E31000000001",
    });
    expect(parseNcfE("E32001000000")).toEqual({
      tipo: "32",
      numero: 1000000,
      ncf: "E32001000000",
    });
    expect(parseNcfE("B0300000001")).toBeNull();
  });

  it("normaliza fechas dmy e iso", () => {
    expect(normalizarFechaDia("02/11/2026")).toBe("2026-11-02");
    expect(normalizarFechaDia("2027-12-31")).toBe("2027-12-31");
    expect(normalizarFechaDia("N/A")).toBe("");
  });

  it("normaliza fila E31 y omite inconsistencias", () => {
    const f = normalizarFilaExtraida({
      tipoComprobante: "31",
      numeroDesde: "E31000000001",
      numeroHasta: "E31000000100",
      cantidadAprobada: 100,
      fechaSolicitud: "02/11/2026",
      fechaVencimiento: "31/12/2027",
      noSolicitud: "6010089871",
      noAutorizacion: "6005658189",
    });
    expect(f).toMatchObject({
      tipo_comprobante: "31",
      numero_inicial: 1,
      numero_final: 100,
      fecha_autorizacion: "2026-11-02",
      fecha_vencimiento: "2027-12-31",
    });
    expect(f.comentario).toContain("6010089871");
    expect(normalizarFilaExtraida({ numeroDesde: "B01", numeroHasta: "B02" })).toBeNull();
  });

  it("parsea cantidad con puntos de miles dominicanos", () => {
    expect(parseCantidadAprobada(10000000)).toBe(10000000);
    expect(parseCantidadAprobada("10.000.000")).toBe(10000000);
    expect(parseCantidadAprobada("10,000,000")).toBe(10000000);
    expect(parseCantidadAprobada(null)).toBeNull();
    expect(parseCantidadAprobada("abc")).toBeNull();
  });

  it("prioriza cantidad aprobada sobre NCF hasta cuando discrepan (tipo 32 / 10M)", () => {
    // OCR/visión leyó hasta como E32001000000 (1_000_000) pero Cantidad Aprobada = 10_000_000
    // desde=1 + cantidad=10M − 1 → numero_final=10_000_000 (rango inclusivo)
    const f = normalizarFilaExtraida({
      tipoComprobante: "32",
      numeroDesde: "E32000000001",
      numeroHasta: "E32001000000",
      cantidadAprobada: 10000000,
      fechaSolicitud: "02/11/2026",
      fechaVencimiento: "N/A",
      noSolicitud: "6010089871",
      noAutorizacion: "6005658190",
    });
    expect(f).toMatchObject({
      tipo_comprobante: "32",
      numero_inicial: 1,
      numero_final: 10000000,
      cantidad: 10000000,
    });

    const conPuntos = normalizarFilaExtraida({
      tipoComprobante: "32",
      numeroDesde: "E32000000001",
      numeroHasta: "E32001000000",
      cantidadAprobada: "10.000.000",
      fechaSolicitud: "02/11/2026",
    });
    expect(conPuntos.numero_final).toBe(10000000);
    expect(conPuntos.cantidad).toBe(10000000);

    // Sin cantidad → cae al NCF hasta
    const sinCantidad = normalizarFilaExtraida({
      tipoComprobante: "32",
      numeroDesde: "E32000000001",
      numeroHasta: "E32001000000",
      cantidadAprobada: null,
      fechaSolicitud: "02/11/2026",
    });
    expect(sinCantidad.numero_final).toBe(1000000);
    expect(sinCantidad.cantidad).toBe(1000000);
  });

  it("valida fila para crear", () => {
    const ok = validarFilaParaCrear(
      {
        tipo_comprobante: "32",
        numero_inicial: 1,
        numero_final: 10,
        fecha_autorizacion: "2026-11-02",
        fecha_vencimiento: "",
        alerta_minima_restante: 10,
      },
      { rnc: "131784862", razonSocial: "WECON" },
    );
    expect(ok.ok).toBe(true);
    expect(ok.body.fecha_vencimiento).toBe("");

    const bad = validarFilaParaCrear(
      { tipo_comprobante: "31", numero_inicial: 1, numero_final: 10, fecha_autorizacion: "" },
      { rnc: "131784862", razonSocial: "WECON" },
    );
    expect(bad.ok).toBe(false);
  });

  it("fusiona extracciones de varias imágenes y conserva todas las series E distintas", () => {
    // Simula 3 fotos: E31 | E32 (+ B04 ignorada en normalizar) | E43+E45
    const img1 = [
      normalizarFilaExtraida({
        tipoComprobante: "31",
        numeroDesde: "E31000000001",
        numeroHasta: "E31000000100",
        cantidadAprobada: 100,
        fechaSolicitud: "02/11/2026",
        fechaVencimiento: "31/12/2027",
        noSolicitud: "6010089871",
        noAutorizacion: "6005658189",
      }),
    ];
    const img2 = [
      normalizarFilaExtraida({
        tipoComprobante: "32",
        numeroDesde: "E32000000001",
        numeroHasta: "E32001000000",
        cantidadAprobada: 10000000,
        fechaSolicitud: "02/11/2026",
        fechaVencimiento: "N/A",
        noSolicitud: "6010089871",
        noAutorizacion: "6005658192",
      }),
      // Serie B no debe entrar (normalizarFilaExtraida → null)
      normalizarFilaExtraida({
        tipoComprobante: "04",
        numeroDesde: "B0400000001",
        numeroHasta: "B0400000500",
        cantidadAprobada: 500,
        noSolicitud: "6010089871",
        noAutorizacion: "6005658194",
      }),
    ].filter(Boolean);
    const img3 = [
      normalizarFilaExtraida({
        tipoComprobante: "43",
        numeroDesde: "E43000000001",
        numeroHasta: "E43000000100",
        cantidadAprobada: 100,
        fechaSolicitud: "02/11/2026",
        fechaVencimiento: "31/12/2027",
        noSolicitud: "6010089871",
        noAutorizacion: "6005658196",
      }),
      normalizarFilaExtraida({
        tipoComprobante: "45",
        numeroDesde: "E45000000001",
        numeroHasta: "E45000000450",
        cantidadAprobada: 450,
        fechaSolicitud: "02/11/2026",
        fechaVencimiento: "31/12/2027",
        noSolicitud: "6010089871",
        noAutorizacion: "6005658200",
      }),
    ];

    const merged = fusionarExtraccionesPorImagen([img1, img2, img3]);
    expect(merged).toHaveLength(4);
    const tipos = merged.map((f) => f.tipo_comprobante).sort();
    expect(tipos).toEqual(["31", "32", "43", "45"]);
    const auts = merged.map((f) => f.no_autorizacion).sort();
    expect(auts).toEqual([
      "6005658189",
      "6005658192",
      "6005658196",
      "6005658200",
    ]);
    // B no aparece
    expect(merged.every((f) => f.prefijo === "E")).toBe(true);

    // Misma autorización repetida en otra "foto" se colapsa
    const withDup = fusionarExtraccionesPorImagen([img1, img1, img2]);
    expect(withDup).toHaveLength(2);
  });

  it("dedup por solicitud+autorización: tipos distintos se conservan; misma aut se omite", () => {
    const base = {
      no_solicitud: "6010089871",
      fecha_autorizacion: "2026-11-02",
      fecha_vencimiento: "2027-12-31",
      alerta_minima_restante: 10,
    };
    const e43 = {
      ...base,
      tipo_comprobante: "43",
      numero_inicial: 1,
      numero_final: 100,
      no_autorizacion: "6005658196",
    };
    const e45 = {
      ...base,
      tipo_comprobante: "45",
      numero_inicial: 1,
      numero_final: 450,
      no_autorizacion: "6005658200",
    };
    const e43Repetida = {
      ...e43,
      numero_inicial: 1,
      numero_final: 100,
      no_autorizacion: "6005658196",
    };
    const e43OtraAut = {
      ...base,
      tipo_comprobante: "43",
      numero_inicial: 101,
      numero_final: 200,
      no_autorizacion: "6005658999",
    };

    expect(claveDedupSolicitud(e43)).toBe("sol:6010089871::aut:6005658196");
    expect(claveDedupSolicitud(e45)).toBe("sol:6010089871::aut:6005658200");
    expect(claveDedupSolicitud(e43)).toBe(claveDedupSolicitud(e43Repetida));
    expect(claveDedupSolicitud(e43)).not.toBe(claveDedupSolicitud(e43OtraAut));

    const dedup = deduplicarFilasPorSolicitud([e43, e45, e43Repetida, e43OtraAut]);
    expect(dedup).toHaveLength(3);
    const auts = dedup.map((f) => f.no_autorizacion).sort();
    expect(auts).toEqual(["6005658196", "6005658200", "6005658999"]);
    const tipos = dedup.map((f) => f.tipo_comprobante).sort();
    expect(tipos).toEqual(["43", "43", "45"]);
  });

  it("colapsa rangos E31 idénticos en un solo lote (sin sol/aut o con los mismos)", () => {
    const base = {
      tipo_comprobante: "31",
      numero_inicial: 1,
      numero_final: 100,
      fecha_autorizacion: "2026-11-02",
      fecha_vencimiento: "2027-12-31",
      comentario: "Solicitud DGII 6010089871 / Aut. 6005658189",
    };
    // Como llegaban tras el bug de UI: sin no_solicitud/no_autorizacion
    const triplicado = [
      { ...base },
      { ...base },
      { ...base },
    ];
    const dedup = deduplicarFilasPorSolicitud(triplicado);
    expect(dedup).toHaveLength(1);
    expect(dedup[0].no_solicitud).toBe("6010089871");
    expect(dedup[0].no_autorizacion).toBe("6005658189");
    expect(dedup[0].numero_final).toBe(100);

    const conCampos = deduplicarFilasPorSolicitud([
      { ...base, no_solicitud: "6010089871", no_autorizacion: "6005658189" },
      { ...base, no_solicitud: "6010089871", no_autorizacion: "6005658189" },
      { ...base, no_solicitud: "6010089871", no_autorizacion: "6005658189" },
    ]);
    expect(conCampos).toHaveLength(1);
  });

  it("colapsa E31 incompleto en el completo; no colapsa dos pares sol/aut distintos", () => {
    const incompleto = {
      tipo_comprobante: "31",
      numero_inicial: 1,
      numero_final: 100,
      no_solicitud: "",
      no_autorizacion: "",
      comentario: "",
      fecha_autorizacion: "2026-11-02",
    };
    const completoA = {
      tipo_comprobante: "31",
      numero_inicial: 1,
      numero_final: 100,
      no_solicitud: "6010089871",
      no_autorizacion: "6005658189",
      comentario: "Solicitud DGII 6010089871 / Aut. 6005658189",
      fecha_autorizacion: "2026-11-02",
    };
    const completoB = {
      tipo_comprobante: "31",
      numero_inicial: 1,
      numero_final: 100,
      no_solicitud: "6010089871",
      no_autorizacion: "6005658188",
      comentario: "Solicitud DGII 6010089871 / Aut. 6005658188",
      fecha_autorizacion: "2026-11-02",
    };
    const e45 = {
      tipo_comprobante: "45",
      numero_inicial: 1,
      numero_final: 450,
      no_solicitud: "6010089871",
      no_autorizacion: "6005658200",
      comentario: "Solicitud DGII 6010089871 / Aut. 6005658200",
      fecha_autorizacion: "2026-11-02",
    };

    // Incompleto + completo A → 1; completo B distinto se conserva; E45 se conserva
    const merged = fusionarExtraccionesPorImagen([
      [incompleto],
      [completoA],
      [completoB, e45],
    ]);
    const e31 = merged.filter((f) => f.tipo_comprobante === "31");
    expect(e31).toHaveLength(2);
    expect(merged.some((f) => f.tipo_comprobante === "45")).toBe(true);
    expect(
      e31.some((f) => f.no_autorizacion === "6005658189"),
    ).toBe(true);
    expect(
      e31.some((f) => f.no_autorizacion === "6005658188"),
    ).toBe(true);

    expect(debenColapsarPorRangoSolapado(incompleto, completoA)).toBe(true);
    expect(debenColapsarPorRangoSolapado(completoA, completoB)).toBe(false);

    const preferred = preferirFilaMasCompleta(incompleto, completoA);
    expect(preferred.no_autorizacion).toBe("6005658189");

    // Solo incompleto + completo → una fila
    expect(
      colapsarPorTipoYRangoSolapado([incompleto, completoA]),
    ).toHaveLength(1);
  });

  it("normaliza tipo desde el NCF aunque el modelo diga 31 (E43)", () => {
    const f = normalizarFilaExtraida({
      tipoComprobante: "31",
      numeroDesde: "E43000000001",
      numeroHasta: "E43000000100",
      cantidadAprobada: 100,
      fechaSolicitud: "02/11/2026",
      fechaVencimiento: "31/12/2027",
      noSolicitud: "6010089871",
      noAutorizacion: "6005658196",
    });
    expect(f).toMatchObject({
      tipo_comprobante: "43",
      numero_inicial: 1,
      numero_final: 100,
      no_autorizacion: "6005658196",
    });
    expect(f.numero_desde).toMatch(/^E43/);
  });

  it("al fusionar misma sol+aut prefiere la fila cuyo tipo coincide con el NCF", () => {
    const malEtiquetada = {
      tipo_comprobante: "31",
      numero_inicial: 1,
      numero_final: 100,
      numero_desde: "E43000000001",
      numero_hasta: "E43000000100",
      no_solicitud: "6010089871",
      no_autorizacion: "6005658196",
      comentario: "Solicitud DGII 6010089871 / Aut. 6005658196",
    };
    const correcta = {
      tipo_comprobante: "43",
      numero_inicial: 1,
      numero_final: 100,
      numero_desde: "E43000000001",
      numero_hasta: "E43000000100",
      no_solicitud: "6010089871",
      no_autorizacion: "6005658196",
      comentario: "Solicitud DGII 6010089871 / Aut. 6005658196",
    };

    expect(filaTipoCoincideConNcf(malEtiquetada)).toBe(false);
    expect(filaTipoCoincideConNcf(correcta)).toBe(true);

    const preferred = preferirFilaMasCompleta(malEtiquetada, correcta);
    expect(preferred.tipo_comprobante).toBe("43");

    // Primera mal etiquetada: al dedup por sol+aut debe ganar la correcta
    const merged = deduplicarFilasPorSolicitud([malEtiquetada, correcta]);
    expect(merged).toHaveLength(1);
    expect(merged[0].tipo_comprobante).toBe("43");

    const mergedReverse = deduplicarFilasPorSolicitud([
      correcta,
      malEtiquetada,
    ]);
    expect(mergedReverse).toHaveLength(1);
    expect(mergedReverse[0].tipo_comprobante).toBe("43");
  });

  it("no colapsa dos E31 con pares sol/aut completos distintos; sí colapsa si falta solicitud", () => {
    const e31AutA = {
      tipo_comprobante: "31",
      numero_inicial: 1,
      numero_final: 100,
      no_solicitud: "6010089871",
      no_autorizacion: "6005658189",
      comentario: "Solicitud DGII 6010089871 / Aut. 6005658189",
    };
    const e31AutB = {
      tipo_comprobante: "31",
      numero_inicial: 1,
      numero_final: 100,
      no_solicitud: "6010089871",
      no_autorizacion: "6005659999",
      comentario: "Solicitud DGII 6010089871 / Aut. 6005659999",
    };
    const e31SinSol = {
      tipo_comprobante: "31",
      numero_inicial: 1,
      numero_final: 100,
      no_solicitud: "",
      no_autorizacion: "",
      comentario: "",
    };

    const keptBoth = deduplicarFilasPorSolicitud([e31AutA, e31AutB]);
    expect(keptBoth).toHaveLength(2);
    expect(keptBoth.map((f) => f.no_autorizacion).sort()).toEqual([
      "6005658189",
      "6005659999",
    ]);

    const collapsed = deduplicarFilasPorSolicitud([e31SinSol, e31AutA]);
    expect(collapsed).toHaveLength(1);
    expect(collapsed[0].no_solicitud).toBe("6010089871");
    expect(collapsed[0].no_autorizacion).toBe("6005658189");
  });

  it("parsea sol/aut desde comentario y detecta solape con secuencia existente", () => {
    expect(
      parseSolicitudAutorizacionDesdeComentario(
        "Solicitud DGII 6010089871 / Aut. 6005658189",
      ),
    ).toEqual({
      no_solicitud: "6010089871",
      no_autorizacion: "6005658189",
    });

    const enriched = enriquecerFilaConSolicitudAutorizacion({
      tipo_comprobante: "31",
      numero_inicial: 1,
      numero_final: 100,
      comentario: "Solicitud DGII 6010089871 / Aut. 6005658189",
    });
    expect(enriched.no_solicitud).toBe("6010089871");
    expect(enriched.no_autorizacion).toBe("6005658189");
    expect(claveDedupSolicitud(enriched)).toBe(
      "sol:6010089871::aut:6005658189",
    );

    expect(rangosSeSolapan(1, 100, 1, 100)).toBe(true);
    expect(rangosSeSolapan(1, 100, 101, 200)).toBe(false);

    const existentes = [
      { tipo_comprobante: "31", numero_inicial: 1, numero_final: 100 },
    ];
    const solape = encontrarSolapeConExistentes(
      { tipo_comprobante: "31", numero_inicial: 1, numero_final: 100 },
      existentes,
    );
    expect(solape).toEqual(existentes[0]);

    // Mismo rango pero otro tipo → no omitir
    expect(
      encontrarSolapeConExistentes(
        { tipo_comprobante: "32", numero_inicial: 1, numero_final: 100 },
        existentes,
      ),
    ).toBeNull();
  });
});
