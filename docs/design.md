# UI: jerarquia de botones de acción

Este documento describe cómo usar el componente [`Button`](../components/ui/button.tsx) y las clases `.btn*` de [`globals.css`](../app/globals.css) de forma consistente.

## Roles (prioridad visual)

| Rol | `variant` | Uso típico | Icono junto al texto |
|-----|-----------|-----------|-----------------------|
| **Primary** | `primary` | Una sola acción principal por contexto (generar, analizar, enviar nuevo). Debe destacar sobre el resto. | Opcional según vista: **en mini-headers de tabs del prospecto, solo el botón principal lleva icono** |
| **Secondary** | `secondary` | Acción alternativa destacada pero no dominante; siempre tiene borde. | Por defecto **sin icono** |
| **Tertiary** | `ghost` | Soporte: cancelar, copiar, sincronizar; sin borde. | **Sin icono** junto al texto |
| **Destructivo** | `danger` | Confirmar pérdida de datos (**solo dentro de modal de confirmación**). | **Sin icono** |
| **Solo icono** | cualquier `variant` + `icon={true}` | Filas densas, toolbars compactas. Obligatorio `title` descriptivo. |

## Modificador icon-only (`icon`)

- Prop: `icon` en `<Button>`
- Obligatorio: `title="..."` (y `aria-label` si procede para lectores de pantalla)
- Tamaños: `sm | md | lg` definen lado del cuadrado (8 / 10 / 12 tailwind spacing)

Migración rápida:

```tsx
// Antes (padding irregular)
<button className="btn btn-ghost p-2 h-8 w-8 ...">

// Después
<Button variant="ghost" size="sm" icon title="Eliminar prospecto">
  <TrashIconSvg />
</Button>
```

## Tamaños

| `size` | Dónde |
|--------|--------|
| `sm` | Mini-headers dentro de pestañas (`Research`, landings, emails, auditoría…) |
| `md` | Formularios estándar, modales estándar (valor por defecto del `Button`) |
| `lg` | CTA destacado dentro de pantalla grande (ej. wizard en modal grande) |

## Orden horizontal (RTL visual: izquierda → derecha)

En una misma barra de acciones:

`[ghost / tertiary…] → [secondary…] → [primary]`

La acción principal queda siempre **a la derecha**.

## Alcance aplicado actualmente

- Vista detalle prospecto y bloques con pestañas: mini-headers uniformizados (`size="sm"`) según estas reglas.
- Otras áreas (`admin`, `login`) pueden seguir usando clases `.btn` directamente; pueden migrarse en otra iteración.
