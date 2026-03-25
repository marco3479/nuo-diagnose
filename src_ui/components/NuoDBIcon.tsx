"use client";

import { useTheme } from "../hooks";

// import Image from 'next/image';
// import { useRouter } from 'next/navigation';
// import { useContext } from 'react';
// import { GlobalContext } from '@/app/(authed)/Client';

// export const NuoDBImage = ({
//   className,
//   fill,
//   width,
//   height,
// }: {
//   className?: string;
//   fill: boolean;
//   width?: number;
//   height?: number;
// }) => {
//   const imageLoader = ({ src }: { src: string }) => {
//     return `https://d33wubrfki0l68.cloudfront.net/571989f106f60bced5326825bd63918a55bdf0aa/dd52a/_/img/${src}`;
//   };

//   return (
//     <Image
//       height={height}
//       width={width}
//       loader={imageLoader}
//       fill={fill}
//       className={`${className} flex relative py-2 -ml-4`}
//       style={{ objectFit: "contain" }}
//       alt="NuoDB logo"
//       priority
//       src="nuodb-bird-only-green.png"
//     />
//   );
// };

// const NuoDBIcon = () => {
//   const router = useRouter();
//   const { organization } = useContext(GlobalContext);

//   return (
//     <span className='flex flex-row'>
//       <span id='nuodb_home'
//       onClick={() => {
//         router.push(`/${organization.name}`)
//       }}
//       className="w-[3.825rem] h-[2.975rem] hover:cursor-pointer flex flex-col justify-self-center place-self-center self-center relative "
//       >

//         {/* <NuoDBImage fill={true} /> */}
//       </span>
//       &nbsp;
//       <span className="hover:text-white transition-colors duration-300 -ml-4 text-lg text-left w-max whitespace-nowrap place-self-center relative">
//         NuoDB
//       </span>
//     </span>
//   );
// };


const NuoDBIcon = () => {
    const { theme, setTheme } = useTheme('dark');

    const strokeColor = theme === 'dark' ? '#FFFFFF' : '#000000';

    return (
        <div style={{ position: 'relative', display: 'inline-block' }}>
            <img src="https://d33wubrfki0l68.cloudfront.net/571989f106f60bced5326825bd63918a55bdf0aa/dd52a/_/img/nuodb-bird-only-green.png" alt="NuoDB Logo" style={{ height: '40px', width: 'auto', display: 'block' }} />
            <svg style={{ position: 'absolute', bottom: '10px', right: '20px', borderRadius: '50%', padding: '2px' }} width="16" height="16" viewBox="0 0 24 24" fill="none"  xmlns="http://www.w3.org/2000/svg">
                <path d="M20 8h-2.81c-.45-.78-1.07-1.45-1.82-1.96L17 4.41 15.59 3l-2.17 2.17C12.96 5.06 12.49 5 12 5s-.96.06-1.41.17L8.41 3 7 4.41l1.62 1.63C7.88 6.55 7.26 7.22 6.81 8H4v2h2.09c-.05.33-.09.66-.09 1v1H4v2h2v1c0 .34.04.67.09 1H4v2h2.81c1.04 1.79 2.97 3 5.19 3s4.15-1.21 5.19-3H20v-2h-2.09c.05-.33.09-.66.09-1v-1h2v-2h-2v-1c0-.34-.04-.67-.09-1H20V8zm-4 4v3c0 .22-.03.47-.07.7l-.1.65-.37.65c-.72 1.24-2.04 2-3.46 2s-2.74-.77-3.46-2l-.37-.64-.1-.65C8.03 15.48 8 15.23 8 15v-4c0-.23.03-.48.07-.7l.1-.65.37-.65c.3-.52.72-.97 1.21-1.31l.57-.39.74-.18c.31-.08.63-.12.94-.12.32 0 .63.04.95.12l.68.16.61.42c.5.34.91.79 1.21 1.31l.38.65.1.65c.04.22.07.47.07.69v1zm-6 2h4v2h-4v-2zm0-4h4v2h-4v-2z" fill="black" />
            </svg>
        </div>
    )
}

export default NuoDBIcon;