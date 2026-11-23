"use client";

/**
 * @file Marca verbal vectorial animada de Ad Astra basada en los siete glifos tipográficos de la
 * asociación. Renderiza SVG en línea con `currentColor` para adaptarse a fondos oscuros, amarillos o claros.
 */

import SVGAnimationWrapper from "../ui/SVGAnimationWrapper";

const SHARED_SCALE_TRANSFORM = "matrix(1.835789,-0.000954,0.000964,1.854709,-497.005605,-89.287751)";

const WORDMARK_LETTERS = [
  {
    key: "a-1",
    width: 210,
    height: 204,
    spacingClass: "",
    outerTransform: "matrix(1,0,0,1,-927.495589,-1151.366042)",
    innerTransform: "matrix(1,0,0,1,-248.173834,0)",
    d: "M1102.488,730.693L1092.53,730.693L1101.909,711.878L1102.488,730.693ZM1102.271,762.034L1101.927,778.998L1138.007,779L1136.005,669.378L1078.374,669.378L1023.726,779L1068.449,778.998L1076.906,762.034L1102.271,762.034Z",
  },
  {
    key: "d-1",
    width: 185,
    height: 204,
    spacingClass: "-ml-[22%]",
    outerTransform: "matrix(1,0,0,1,-1092.223896,-1151.342389)",
    innerTransform: "matrix(1,0,0,1,-7.040392,0)",
    d: "M940.061,722.621C940.061,733.828 931.142,742.95 920.015,743.28L920.015,743.289L905.788,743.289L905.788,701.954L920.015,701.954L920.015,701.963C931.142,702.293 940.061,711.415 940.061,722.621L940.061,722.621ZM972.849,724.189C972.849,694.47 949.194,670.275 919.684,669.402L919.684,669.378L872.382,669.377L872.477,679.208L872.477,779L919.684,779L919.684,778.975C949.194,778.103 972.849,753.908 972.849,724.189L972.849,724.189Z",
  },
  {
    key: "a-2",
    width: 210,
    height: 205,
    spacingClass: "-ml-[10%]",
    outerTransform: "matrix(1,0,0,1,-1289.867982,-1154.440752)",
    innerTransform: "matrix(1,0,0,1,-51.042845,1.760098)",
    d: "M1102.488,730.693L1092.53,730.693L1101.909,711.878L1102.488,730.693ZM1102.271,762.034L1102.188,779.683L1138.11,779.684L1137.765,669.378L1078.374,669.378L1023.987,779.684L1068.71,779.683L1076.906,762.034L1102.271,762.034Z",
  },
  {
    key: "s-1",
    width: 225,
    height: 204,
    spacingClass: "ml-[6.5%]",
    outerTransform: "matrix(1,0,0,1,-1509.071706,-1154.420637)",
    innerTransform: "matrix(1,0,0,1,-121.44677,1.760098)",
    d: "M1335.397,708.317L1335.397,687.831C1335.397,677.49 1327.482,669.525 1317.141,669.525L1232.57,669.379C1222.228,669.379 1213.845,677.763 1213.845,688.104C1213.845,688.726 1213.877,689.34 1213.936,689.946L1213.845,689.912L1213.845,697.095C1213.845,712.172 1224.972,717.782 1241.149,724.393L1288.437,741.549L1213.845,741.549L1213.845,760.275C1213.845,770.617 1222.228,779 1232.57,779L1317.473,779C1327.813,779 1336.197,770.617 1336.197,760.275C1336.197,759.798 1336.173,759.326 1336.139,758.858L1336.197,758.88L1336.197,751.697C1336.197,736.62 1325.071,731.01 1308.893,724.393L1260.475,708.59L1335.397,708.317Z",
  },
  {
    key: "t-1",
    width: 229,
    height: 204,
    spacingClass: "ml-[-9%]",
    outerTransform: "matrix(1,0,0,1,-1692.720333,-1154.22119)",
    innerTransform: "matrix(1,0,0,1,-121.44677,1.760098)",
    d: "M1437.149,708.317L1438.308,669.378L1313.893,669.519L1315.353,708.317L1350.695,708.317L1350.695,779L1389.487,779L1389.487,708.317L1437.149,708.317Z",
  },
  {
    key: "r-1",
    width: 239,
    height: 204,
    spacingClass: "ml-[-12%]",
    outerTransform: "matrix(1,0,0,1,-1912.414772,-1154.142911)",
    innerTransform: "matrix(1,0,0,1,-121.44677,1.760098)",
    d: "M1516.414,704.122L1516.414,705.05C1516.414,708.614 1510.571,711.505 1503.363,711.505L1470.888,711.505L1470.888,697.667L1503.363,697.667C1510.571,697.667 1516.414,700.557 1516.414,704.122ZM1563.165,779L1540.482,734.68C1546.992,729.039 1551.114,720.718 1551.114,711.429L1551.114,700.145C1551.114,683.152 1537.339,669.378 1520.346,669.378L1433.566,669.525L1433.97,779L1470.888,779L1470.888,742.196L1506.479,742.196L1525.315,779L1563.165,779L1563.165,779Z",
  },
  {
    key: "a-3",
    width: 210,
    height: 205,
    spacingClass: "-ml-[8%]",
    outerTransform: "matrix(1,0,0,1,-2159.052327,-1154.039675)",
    innerTransform: "matrix(-1,0,0,1,2589.801325,1.760098)",
    d: "M1107.768,730.693L1097.81,730.693L1107.189,711.878L1107.768,730.693ZM1107.551,762.034L1107.468,779.683L1143.391,779.684L1143.045,669.378L1140.696,669.378L1140.697,669.376L1102.717,669.377L1086.002,669.376L1086.002,669.378L1083.654,669.378L1029.267,779.684L1073.991,779.683L1082.186,762.034L1107.551,762.034Z",
  },
];

/**
 * Renderiza el logotipo verbal animado «Ad Astra» delegando los siete glifos en `SVGAnimationWrapper`.
 * Hereda el color del texto actual (`currentColor`) y expone texto accesible mediante `ariaLabel`.
 *
 * @param props Propiedades del logotipo animado.
 * @param props.ariaLabel Texto equivalente para lectores de pantalla e impresoras de pruebas.
 * @param props.inline Omite el relleno vertical de `0.5` cuando se inserta en línea junto a texto corrido.
 * @param props.className Clases de tamaño, alineación y color aplicadas al contenedor externo.
 * @param props.wrapperProps Resto de propiedades reenviadas a `SVGAnimationWrapper` (`as`, `animateOnLoad`, etc.).
 * @returns Marca tipográfica vectorial animada en línea o como encabezado.
 */
export default function AnimatedWordmark({
  ariaLabel = "Ad Astra",
  inline = false,
  className = "",
  ...wrapperProps
}) {
  return (
    <SVGAnimationWrapper
      {...wrapperProps}
      ariaLabel={ariaLabel}
      layerPaddingClass={inline ? "py-0" : "py-0.5"}
      className={className}
    >
      {WORDMARK_LETTERS.map(
        ({ key, width, height, spacingClass, outerTransform, innerTransform, d }) => (
          <svg
            key={key}
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            fill="currentColor"
            fillRule="evenodd"
            clipRule="evenodd"
            aria-hidden="true"
            focusable="false"
            style={{ aspectRatio: `${width} / ${height}` }}
            className={`block h-full w-auto max-w-none ${spacingClass}`.trim()}
          >
            <g transform={outerTransform}>
              <g transform={SHARED_SCALE_TRANSFORM}>
                <g transform={innerTransform}>
                  <path d={d} />
                </g>
              </g>
            </g>
          </svg>
        ),
      )}
    </SVGAnimationWrapper>
  );
}
