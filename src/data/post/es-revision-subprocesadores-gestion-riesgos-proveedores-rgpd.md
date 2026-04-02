---
publishDate: 2026-03-03T00:00:00Z
updateDate: 2026-04-02T00:00:00Z
title: 'Revisión de Subprocesadores y Gestión de Riesgos de Proveedores en Organizaciones Sanitarias de la UE: Guía Práctica'
excerpt: Las organizaciones sanitarias de la UE deben identificar a cada proveedor que accede a datos de pacientes, incluidos los subencargados. Esta guía cubre el proceso completo para identificar, evaluar y gestionar encargados del tratamiento bajo el RGPD.
image: ~/assets/images/gdpr-subprocessor-cover.jpg
category: RGPD y Cumplimiento
tags:
  - rgpd
  - sanidad
  - cumplimiento
  - subprocesadores
  - gestión de riesgos de proveedores
  - acuerdos de tratamiento de datos
  - transferencias internacionales de datos
  - decisiones de adecuación de la ue
  - marco de privacidad de datos
  - dpd
  - artículo 28
  - terceros encargados del tratamiento
lang: es
translationOf: gdpr-subprocessor-management-eu-healthcare
metadata:
  title: 'Gestión de Subprocesadores RGPD en Sanidad | Guía Práctica'
  description: 'Cómo las organizaciones sanitarias de la UE gestionan subencargados RGPD: ATDs, decisiones de adecuación, verificación del Marco de Privacidad y flujo de trabajo de gestión de riesgos.'
  robots:
    index: true
    follow: true
  openGraph:
    type: article
    images:
      - url: ~/assets/images/gdpr-subprocessor-cover.jpg
        width: 1200
        height: 630
  twitter:
    cardType: summary_large_image
---

> **Puntos Clave**
> - Los subencargados del tratamiento bajo el Artículo 28 del RGPD requieren un Acuerdo de Tratamiento de Datos — la responsabilidad bajo el RGPD se extiende a toda la cadena de subencargados, no solo a los proveedores directos.
> - Los proveedores estadounidenses necesitan verificación activa de su autocertificación en el Marco de Privacidad de Datos UE-EE.UU. en dataprivacyframework.gov — la decisión de adecuación de EE.UU. no es una autorización general para todas las empresas americanas.
> - Las ubicaciones de tratamiento de datos desconocidas constituyen una infracción del RGPD y no deben continuar sin salvaguardias documentadas.
> - El RGPD exige un seguimiento continuo, no una revisión puntual, en virtud de los estándares de responsabilidad proactiva.
> - La Evaluación de Impacto de la Transferencia (EIT) es obligatoria para países terceros sin decisión de adecuación, junto con las Cláusulas Contractuales Tipo.

Las organizaciones sanitarias de la Unión Europea operan bajo algunas de las leyes de protección de datos más exigentes del mundo. Cuando se gestionan datos de pacientes — en especial datos sanitarios clasificados como «datos de categoría especial» bajo el Artículo 9 del RGPD — la responsabilidad no se limita al proveedor principal. Se extiende a los subencargados del tratamiento e incluso más abajo en la cadena de suministro. Si no se sabe quién accede en última instancia a los datos de los pacientes, no se controla el riesgo.

---

## Qué Es un Subencargado del Tratamiento

Un subencargado del tratamiento es un tercero contratado por un encargado del tratamiento para tratar datos personales en nombre del responsable del tratamiento. Aunque el término no se define explícitamente en el RGPD, su uso está ampliamente extendido en los marcos de privacidad y seguridad — incluidos el RGPD, la CCPA, SOC 2 e ISO 27001 — para designar a los terceros que tratan datos en nombre de un encargado del tratamiento.

En términos sencillos: la organización sanitaria es habitualmente el responsable del tratamiento. Un proveedor (por ejemplo, un proveedor de SaaS de historia clínica electrónica) es el encargado del tratamiento. Si ese proveedor utiliza otra empresa — un proveedor de alojamiento, un servicio de analítica, un contratista de soporte — esa empresa se convierte en el subencargado del tratamiento.

**Ejemplo práctico:** Un hospital contrata a un proveedor SaaS de historia clínica electrónica. Ese proveedor usa AWS para el alojamiento. AWS es el subencargado del tratamiento. El subencargado trata datos personales de forma indirecta, pero sigue formando parte de la cadena de cumplimiento.

No todo proveedor es un subencargado del tratamiento. Un proveedor solo se clasifica como tal si trata datos personales en nombre de la organización. Una empresa que suministra mobiliario de oficina o servicios de limpieza no trata datos personales y queda completamente fuera del ámbito de aplicación.

Entre los subencargados del tratamiento habituales en el sector sanitario se encuentran:

- Proveedores de servicios en la nube (AWS, Google Cloud, Azure)
- Procesadores de pago (Stripe, Adyen)
- Plataformas de gestión de identidades (Okta, Auth0)
- Sistemas CRM (Salesforce, HubSpot)
- Soluciones de envío de correo electrónico (SendGrid, Mailchimp)
- Plataformas de gestión financiera (NetSuite, Sage)

---

## Por Qué Es Necesario Hacer un Seguimiento de los Subencargados

![Documentación jurídica y responsabilidad de cumplimiento para la protección de datos sanitarios en la UE](~/assets/images/subprocessor-vendor-workflow.jpg)

Hacer un seguimiento de los subencargados del tratamiento no es burocracia. Es control del riesgo y, en el ámbito sanitario, las consecuencias son especialmente graves. Los datos sanitarios son datos personales sensibles. Las brechas de seguridad pueden acarrear sanciones cuantiosas. La confianza de los pacientes se deteriora con facilidad. Los proveedores externos han sido responsables de una parte significativa de las brechas de datos sanitarios, con incidentes que pueden suponer costes de millones de euros por evento.

**Cumplimiento normativo.** Bajo el Artículo 28 del RGPD, los responsables del tratamiento deben garantizar que los encargados ofrezcan garantías suficientes; los encargados deben obtener autorización antes de contratar a subencargados; y la responsabilidad puede trasladarse de vuelta a lo largo de la cadena. Las organizaciones están obligadas a informar a los interesados sobre los subencargados del tratamiento que manejan sus datos personales. Del mismo modo, los controles SOC 2 CC3.1, CC3.2, CC3.3 y CC9.2, junto con las Cláusulas A.15.1.1 y A.15.2.1 de la norma ISO 27001, exigen una documentación clara de los flujos de datos y del tratamiento por parte de terceros.

**Seguridad de los datos y gestión del riesgo.** Conocer a los subencargados del tratamiento permite evaluar sus medidas de seguridad, reduce el riesgo de brechas o problemas de cumplimiento, y facilita la realización proactiva de evaluaciones de riesgo. Sin esta visibilidad, una brecha en un subencargado podría exponer miles de registros de pacientes antes de que la organización tenga conocimiento de ello.

**Transparencia en los flujos de datos.** Entender dónde se tratan, almacenan y transmiten los datos ayuda a las organizaciones a evaluar los riesgos asociados a las transferencias transfronterizas de datos — en particular cuando los datos se transfieren a países con una legislación diferente en materia de protección de datos.

**Responsabilidad contractual.** Bajo el Artículo 28(3) del RGPD, un Acuerdo de Tratamiento de Datos es un requisito jurídicamente vinculante que establece las obligaciones del subencargado en cuanto al manejo de los datos, las notificaciones de brechas y el cumplimiento normativo. Todo subencargado del tratamiento que acceda a datos personales debe estar cubierto por un ATD.

**Seguimiento continuo.** Los riesgos evolucionan. El seguimiento continuo permite a las organizaciones mantenerse al corriente de los cambios en el perfil de riesgo de los proveedores una vez superada la revisión de seguridad inicial, generando alertas y hallazgos con el tiempo para que los equipos puedan evaluar el impacto y decidir cuándo es necesario actuar. Un proveedor que cumplía las exigencias en el momento de su incorporación puede haber modificado sus prácticas, infraestructura o titularidad empresarial desde entonces.

Para una visión completa de las [obligaciones RGPD para proveedores sanitarios](/es/guia-cumplimiento-rgpd-consultas-sanitarias) aplicables a su organización, consulte nuestra guía de referencia.

---

## Gestión de Riesgos de Proveedores en el Sector Sanitario de la UE

La Gestión de Riesgos de Proveedores es el proceso estructurado de evaluación, seguimiento y gestión de los riesgos asociados a los proveedores de servicios externos. En las organizaciones sanitarias, este proceso debe incluir el cumplimiento de la normativa de protección de datos, las certificaciones de seguridad (ISO 27001, SOC 2), el análisis de la residencia de los datos, la transparencia sobre los subencargados del tratamiento y el seguimiento continuo.

La revisión no puede ser un ejercicio de verificación puntual. Debe ser continua. Las plataformas de Gobierno, Riesgo y Cumplimiento (GRC) ayudan a gestionar el inventario de proveedores — desde la incorporación y el descubrimiento de nuevos proveedores hasta el mantenimiento actualizado del perfil de cada uno, la realización de revisiones de seguridad y el seguimiento del riesgo a lo largo del tiempo.

Del mismo modo que HIPAA exige Acuerdos de Asociado de Negocios, el RGPD requiere acuerdos claros con los encargados del tratamiento. Las organizaciones deben supervisar el cumplimiento de los proveedores exigiendo derechos de auditoría o certificaciones, y garantizar que las mismas obligaciones se trasladen a los subencargados del tratamiento. Toda entidad que trate datos de pacientes en nombre de la organización debe cumplir los estándares del RGPD.

Para un análisis detallado de las [obligaciones del Artículo 28 sobre subprocesadores en cadenas de herramientas de agentes IA](/es/agentes-ia-sanidad-riesgos-rgpd), consulte nuestro artículo monográfico.

---

## ¿A Qué Países Pueden Transferirse Legalmente Datos Personales de la UE?

El RGPD regula de forma estricta la transferencia de datos personales desde la UE a países fuera del Espacio Económico Europeo. En virtud del Artículo 45, la Comisión Europea puede determinar que un tercer país ofrece un nivel adecuado de protección de datos — es decir, garantías esencialmente equivalentes a las que rigen dentro de la UE. Cuando existe una decisión de adecuación, los datos personales pueden transferirse libremente a ese país sin necesidad de salvaguardias adicionales como las Cláusulas Contractuales Tipo o las Normas Corporativas Vinculantes.

**A principios de 2026, la Comisión Europea ha adoptado decisiones de adecuación para los siguientes países y territorios:**

- Andorra
- Argentina
- Brasil *(adecuación mutua adoptada en 2026)*
- Canadá *(para entidades sujetas a la PIPEDA)*
- Islas Feroe
- Guernesey
- Isla de Man
- Israel
- Japón
- Jersey
- Nueva Zelanda
- República de Corea (Corea del Sur)
- Suiza
- Reino Unido *(renovada en diciembre de 2025)*
- Estados Unidos *(bajo el Marco de Privacidad de Datos UE-EE.UU., adoptado en julio de 2023)*
- Uruguay
- Organización Europea de Patentes *(julio de 2025 — primera organización internacional en recibir adecuación)*

> **Importante:** Las decisiones de adecuación no son permanentes. La Comisión Europea supervisa de forma continua las prácticas de protección de datos en terceros países y puede revocar o suspender una decisión si la protección adecuada deja de estar garantizada. La decisión de adecuación de EE.UU. fue revisada en octubre de 2024 y mantenida. Las organizaciones sanitarias deben verificar el estado de las decisiones de adecuación aplicables antes de completar una evaluación de riesgos de proveedores.

Para las organizaciones sanitarias, esta lista es el punto de partida de referencia. Si un subencargado almacena o trata datos en uno de estos países, el mecanismo de transferencia es sencillo. Si el subencargado opera en un país que no figura en la lista, se requieren salvaguardias adicionales — Cláusulas Contractuales Tipo, Normas Corporativas Vinculantes o una derogación válida en virtud del Artículo 49.

**Referencia clave:** [Decisiones de adecuación de la Comisión Europea](https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/adequacy-decisions_en)

---

## Estados Unidos: El Marco de Privacidad de Datos y el Registro de Autocertificación

Estados Unidos no goza de adecuación general. A diferencia de la mayoría de los países con decisión de adecuación, donde la legislación nacional ofrece una protección general, la decisión de adecuación de EE.UU. se aplica **exclusivamente a las empresas que se han autocertificado** bajo el Marco de Privacidad de Datos UE-EE.UU. (DPF), adoptado por la Comisión Europea el 10 de julio de 2023.

Para adherirse al Marco de Privacidad de Datos, una empresa debe autocertificarse ante el Departamento de Comercio de EE.UU. declarando que cumple los principios del DPF. Las empresas participantes deben renovar su certificación anualmente, y el incumplimiento puede constituir una infracción de la Sección 5 de la Ley FTC.

**Quién puede participar:** Para ser elegible para la certificación, una organización debe estar sujeta a las competencias de investigación y aplicación de la Comisión Federal de Comercio (FTC) o del Departamento de Transporte de EE.UU. Determinados sectores — incluidos la banca, los seguros y las telecomunicaciones — no pueden participar actualmente en el programa DPF.

**La verificación es obligatoria.** Antes de transferir datos personales a una empresa estadounidense que afirme contar con la certificación DPF, es imprescindible verificar que la empresa dispone de una autocertificación activa y que dicha certificación cubre los datos en cuestión. Las certificaciones deben renovarse anualmente, y la lista pública del DPF también muestra las organizaciones que han sido dadas de baja junto con los motivos de la misma. Asumir el cumplimiento sin verificación no es aceptable.

**Ejemplo práctico — Anthropic:** No todos los grandes proveedores tecnológicos estadounidenses figuran en el Marco de Privacidad de Datos. Anthropic — la empresa detrás de Claude AI — no parece contar con una autocertificación DPF activa. Esto no significa que las organizaciones sanitarias de la UE no puedan utilizar sus servicios, pero sí implica que la decisión de adecuación de EE.UU. no se aplica a las transferencias de datos a Anthropic. En consecuencia, las organizaciones deben recurrir a mecanismos alternativos de transferencia. Anthropic ofrece un Anexo de Tratamiento de Datos que incorpora las Cláusulas Contractuales Tipo (Módulos 1, 2 y 3) para cubrir las transferencias internacionales de datos. Su ATD también incluye disposiciones de gestión de subencargados que obligan a Anthropic a proporcionar un aviso razonable antes de designar a nuevos subencargados, con un plazo de diez días para que los clientes puedan formular objeciones.

Este es un ejemplo práctico de por qué resulta imprescindible consultar la lista del DPF para cada proveedor estadounidense específico — la decisión de adecuación no es una autorización general para todas las empresas americanas, y las organizaciones sanitarias deben verificar el mecanismo de transferencia aplicable a cada proveedor de forma individual.

**Referencias clave:**
- [Lista del Marco de Privacidad de Datos](https://www.dataprivacyframework.gov/list)
- [Decisión de adecuación del Marco de Privacidad de Datos UE-EE.UU.](https://eur-lex.europa.eu/eli/dec_impl/2023/1795/oj)

---

## Qué Hacer si un Subencargado Está en un Tercer País o la Ubicación de los Datos Es Desconocida

Si un proveedor no puede revelar claramente dónde se almacenan los datos, qué subencargados están implicados o si se producen transferencias transfronterizas, esto debe considerarse una señal de alarma. Una ubicación de datos desconocida puede vulnerar las obligaciones de transparencia del RGPD, socavar los derechos de los pacientes y dificultar el cumplimiento del plazo de notificación de brechas.

**Paso 1 — Solicitar transparencia total.** Se debe pedir al subencargado que revele todas las ubicaciones de tratamiento de datos, incluidos los centros de datos principales, los sitios de copia de seguridad y recuperación ante desastres, y los subencargados adicionales que pueda contratar. Si no puede o no quiere revelarlas, debe tratarse como una señal de alarma significativa.

**Paso 2 — Cotejar con la lista de adecuación.** Se deben comparar las ubicaciones comunicadas con la lista de países con decisión de adecuación de la Comisión Europea. Si todo el tratamiento se realiza dentro del EEE o en un país con decisión de adecuación, la transferencia es admisible en virtud del Artículo 45.

**Paso 3 — Para países sin decisión de adecuación, aplicar salvaguardias.** Si un subencargado trata datos en un país sin decisión de adecuación — por ejemplo, India, China o numerosos países de África y el Sudeste Asiático — es obligatorio aplicar salvaguardias adecuadas en virtud del Artículo 46 del RGPD. El mecanismo más habitual son las Cláusulas Contractuales Tipo. También es necesario realizar una Evaluación de Impacto de la Transferencia para evaluar si la legislación del país de destino podría menoscabar las protecciones que ofrecen las CCT.

**Paso 4 — Ante ubicaciones desconocidas, no proceder.** Si un subencargado no puede confirmar dónde se tratan los datos, no deben transferirse datos personales a ese proveedor. El RGPD hace recaer la carga de la responsabilidad proactiva en el responsable del tratamiento. Tratar datos personales de la UE en una jurisdicción desconocida es indefendible ante una investigación regulatoria o una brecha de seguridad.

**Paso 5 — Incluir restricciones contractuales.** El ATD debe incluir restricciones geográficas que especifiquen dónde está autorizado el subencargado a tratar los datos, y exigir consentimiento previo por escrito antes de cualquier cambio en la ubicación de tratamiento. Esto es especialmente importante para los datos sanitarios clasificados como datos de categoría especial bajo el Artículo 9 del RGPD.

**Paso 6 — Realizar una EIPD.** Para transferencias de alto riesgo que impliquen datos sanitarios que crucen fronteras, se recomienda — o puede ser legalmente obligatoria — una Evaluación de Impacto en la Protección de Datos (EIPD) en virtud del Artículo 35 del RGPD.

Para las organizaciones que estudian una arquitectura local como respuesta a los riesgos de transferencia, véase nuestro análisis del [enfoque arquitectónico para la soberanía de datos ante riesgos de transferencia desconocidos](/es/por-que-sanidad-necesita-ia-local).

---

## Flujo de Trabajo para la Revisión de Subencargados en Organizaciones Sanitarias

La gestión de subencargados del tratamiento en una organización sanitaria bajo el RGPD es un proceso continuo y estructurado. A continuación se describe el flujo de trabajo recomendado.

**Paso 1 — Incorporación del proveedor.** Determinar si el proveedor actúa como encargado del tratamiento. Solicitar una lista de subencargados. Obtener un Acuerdo de Tratamiento de Datos. Elaborar y mantener un registro exhaustivo de todos los proveedores que tratan datos personales en nombre de la organización, clasificando cada uno como subencargado del tratamiento o no subencargado.

**Paso 2 — Identificación de subencargados.** Mapear todos los subencargados del tratamiento. Clasificar cada uno según el tipo de datos tratados, la sensibilidad de los datos y la ubicación geográfica.

**Paso 3 — Evaluación de la jurisdicción.** Comprobar si el país cuenta con una decisión de adecuación de la UE. Si el subencargado está establecido en EE.UU., verificar la certificación DPF activa en [dataprivacyframework.gov/list](https://www.dataprivacyframework.gov/list). Si el país carece de decisión de adecuación, exigir Cláusulas Contractuales Tipo más una Evaluación de Impacto de la Transferencia.

**Paso 4 — Revisión de seguridad y cumplimiento.** Evaluar las certificaciones (ISO 27001, SOC 2). Revisar la postura de respuesta a incidentes. Evaluar el cifrado y los controles de acceso. Comprobar el historial de brechas. Garantizar que las prácticas de seguridad del subencargado se alinean con las políticas y estándares de la organización.

**Paso 5 — Valoración del riesgo.** Asignar un nivel de riesgo: Bajo, Medio, Alto o Crítico. Esta valoración debe basarse en el volumen y la sensibilidad de los datos tratados, las ubicaciones de tratamiento, el impacto de un posible fallo o brecha, y la postura de seguridad del proveedor. Documentar el riesgo residual.

**Paso 6 — Aprobación o rechazo.** Aprobar con las salvaguardias aplicables. Aprobar condicionalmente a la subsanación de las deficiencias identificadas. O rechazar al proveedor por completo. Documentar la decisión y los motivos en el registro de riesgos de proveedores.

**Paso 7 — Marco contractual.** Formalizar un ATD conforme al Artículo 28(3) del RGPD, que cubra: la naturaleza y finalidad del tratamiento; las categorías de datos e interesados; la duración del tratamiento; las obligaciones de notificación de brechas; las restricciones geográficas sobre el tratamiento de datos; los derechos de auditoría; y los requisitos de notificación de cambios en los subencargados.

![Organización sanitaria firmando un Acuerdo de Tratamiento de Datos conforme al RGPD con un proveedor](~/assets/images/gdpr-dpa-signing.jpg)

**Paso 8 — Seguimiento continuo.** Realizar revisiones periódicas — al menos anuales para los proveedores de alto riesgo, y con carácter inmediato cuando se produzcan cambios materiales como adquisiciones, cambios de infraestructura o incidentes de seguridad. Supervisar la lista del DPF para detectar cambios en el estado de certificación de los proveedores estadounidenses. Hacer un seguimiento de las modificaciones en la lista de decisiones de adecuación de la UE. Controlar la incorporación de nuevos subencargados por parte de los proveedores existentes. Utilizar herramientas de seguimiento continuo para detectar alertas cuando cambie el perfil de riesgo de un proveedor.

**Paso 9 — Desvinculación.** Cuando finaliza la relación con un subencargado, verificar la supresión segura o la devolución de todos los datos personales. Revocar todas las credenciales de acceso y permisos en los sistemas. Obtener confirmación escrita de la destrucción de los datos. Actualizar el registro de subencargados en consecuencia.

---

## Preguntas Frecuentes

**¿Qué es un subencargado del tratamiento bajo el Artículo 28 del RGPD?**

Un subencargado del tratamiento es un tercero contratado por un encargado del tratamiento para llevar a cabo actividades de tratamiento en nombre del responsable del tratamiento. En virtud del Artículo 28 del RGPD, los encargados no pueden contratar a subencargados sin autorización previa del responsable, y toda relación de subencargo debe regirse por un contrato que imponga las mismas obligaciones de protección de datos que las establecidas en el acuerdo de tratamiento principal. El responsable del tratamiento sigue siendo responsable del cumplimiento por parte del subencargado.

**¿Deben las organizaciones sanitarias de la UE auditar a sus subencargados?**

Sí. El Artículo 28 del RGPD exige a los responsables del tratamiento que se aseguren de que sus encargados ofrezcan garantías suficientes para aplicar las medidas técnicas y organizativas adecuadas. Esto implica la obligación de evaluar y verificar el cumplimiento de los subencargados — no solo en el momento de la incorporación, sino de forma continua. La Cláusula A.15.2.1 de la norma ISO 27001 y el control CC9.2 de SOC 2 refuerzan la necesidad de una revisión continua de los proveedores, no limitada al contrato inicial.

**¿Cómo se verifica la autocertificación en el Marco de Privacidad de Datos (DPF) de EE.UU.?**

Se debe acceder a [dataprivacyframework.gov/list](https://www.dataprivacyframework.gov/list) y buscar la empresa específica por nombre. La lista muestra las certificaciones activas y sus fechas de renovación, así como las empresas que han participado anteriormente pero han sido dadas de baja. Es necesario verificar que la certificación cubre las categorías de datos personales que se pretenden transferir — algunas certificaciones abarcan únicamente datos de recursos humanos. La re-verificación anual es una buena práctica, dado que las certificaciones deben renovarse cada año.

**¿Qué ocurre si un subencargado se encuentra en una jurisdicción desconocida?**

Si un subencargado no puede o no quiere revelar dónde se tratan los datos personales, el responsable del tratamiento no debe transferir datos a ese proveedor. El RGPD hace recaer la carga de la responsabilidad proactiva en el responsable del tratamiento, y el tratamiento en una jurisdicción desconocida vulnera los principios de transparencia del RGPD establecidos en los Artículos 5 y 13-14. En caso de brecha o investigación regulatoria, la imposibilidad de identificar dónde se trataron los datos será considerada un factor agravante por las autoridades de supervisión.

**¿Con qué frecuencia deben las organizaciones sanitarias revisar a sus subencargados?**

Como mínimo, de forma anual — aunque en la práctica, las revisiones también deben realizarse ante eventos materiales: adquisiciones o cambios en la titularidad del proveedor, migraciones de infraestructura, incorporación de nuevos subencargados a la cadena, cambios en las decisiones de adecuación o en el estado de certificación DPF, y cualquier incidente de seguridad. Los proveedores de alto riesgo que tratan datos sanitarios de categoría especial deben revisarse con mayor frecuencia que los proveedores de bajo riesgo.

---

## La Realidad Práctica en el Sector Sanitario

Muchas organizaciones sanitarias no mantienen listas actualizadas de subencargados del tratamiento. No verifican la certificación DPF para los proveedores estadounidenses. No realizan correctamente las Evaluaciones de Impacto de la Transferencia. Dan por supuesto que los grandes proveedores en la nube cumplen automáticamente con la normativa. Este planteamiento conlleva un riesgo considerable. Los reguladores esperan una diligencia debida documentada.

Un proceso de revisión sólido debe:

- Mantener un inventario documentado de subencargados del tratamiento
- Verificar las decisiones de adecuación de la UE para cada jurisdicción
- Confirmar el registro DPF en los casos aplicables a EE.UU.
- Exigir Cláusulas Contractuales Tipo y Evaluaciones de Impacto de la Transferencia para las transferencias a terceros países
- Garantizar la transparencia y el control contractual sobre las ubicaciones de los datos
- Incluir reevaluaciones periódicas — no limitadas a las comprobaciones de incorporación

Si no se puede explicar quién trata los datos de los pacientes, dónde se almacenan y bajo qué base jurídica se transfieren, no se controla la postura de cumplimiento. En el ámbito sanitario, eso es inaceptable.

Comience con nuestra [Hoja de Ruta de Automatización gratuita](/es/hoja-de-ruta-de-automatizacion) — evaluamos el tratamiento de datos de su centro, identificamos oportunidades de automatización segura y elaboramos una hoja de ruta de cumplimiento clara, sin coste alguno.

---

## Referencias

1. [Decisiones de adecuación en materia de protección de datos de la UE](https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/adequacy-decisions_en) — Comisión Europea
2. [Lista del Marco de Privacidad de Datos UE-EE.UU.](https://www.dataprivacyframework.gov/list) — Departamento de Comercio de EE.UU.
3. [Decisión de adecuación del Marco de Privacidad de Datos UE-EE.UU.](https://eur-lex.europa.eu/eli/dec_impl/2023/1795/oj) — EUR-Lex
4. [¿Qué es un subprocesador?](https://help.drata.com/en/articles/9792194-what-is-a-subprocessor) — Drata
5. [Visión general de la Gestión de Riesgos de Terceros](https://help.vanta.com/en/articles/11345557-third-party-risk-management-overview) — Vanta
6. Artículos 9, 28, 35, 45 y 46 del RGPD — Reglamento (UE) 2016/679

---

*Este artículo tiene carácter exclusivamente informativo y no constituye asesoramiento jurídico. Las organizaciones sanitarias deben consultar con asesores jurídicos cualificados para las decisiones de cumplimiento específicas a su situación.*
