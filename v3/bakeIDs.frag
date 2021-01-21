#include "traceRay.frag"
#include "utils.frag"

#define MAX_NUMBER_OF_IDS 1024 //has to be 1024, due to getNumberOfIntensities not being designed for bigger inputs

//workaround to write vector at dynamic index, to avoid error X3500: Array reference cannot be used as an l-value,not natively addressable
void fillVectorAtIndex (inout uvec3 vec, uint index, int value)
{
	if(index == 0u){
		vec[0] = value;
	}
	else if (index == 1u){
		vec[1] = value;
	}
	else{
		vec[2] = value;
	}
}

//returns a value from the intensity sequence, normalized from [0,255] to [0,1]
//intensity sequence: 256 values, starting with 255 and then the following values with maximal distance to the previous ones: 255,0,127,192,64,...
//this is achieved by iterating though all 8 bits of 256, in different phases
float getIntensity( uint patternIdx )
{
	uint idx = (patternIdx - 1u)%256u; //all bits 1 comes first, then all 0, then MSB 1, etc. -> everything is shifted by one
	uint intensity = 0u;
	//builds the number bit-by-bit, each bit cycling in a different phase
	//this loop can be unrolled to this:
	//intensity+=128*( idx     %2);
	//intensity+=64* ((idx/2  )%2);
	//intensity+=32* ((idx/4  )%2);
	//intensity+=16* ((idx/8  )%2);
	//intensity+=8*  ((idx/16 )%2);
	//intensity+=4*  ((idx/32 )%2);
	//intensity+=2*  ((idx/64 )%2);
	//intensity+=    ((idx/128)%2);
	for(uint i=0u;i<8u;i++)
	{
		intensity+=uint(pow(2u,7u-i))*((idx/uint(pow(2u,i)))%2u); 
	}
	return (float)intensity/255.0;

}

//workaround for floor(pow(idIn, 1.0/3.0)), since it is slow and not precise enough
//Is only designed to work for idIn<=1024, which is ensured by the parameter of the call to getUniqueColor.
uint getFloorOfCubeRoot( uint idIn )
{
	uint wholenNumbers[10] = {1,8,27,64,125,216,343,512,729,1000};
	for(uint i=0;i<10;i++)
	{
		if(idIn< wholenNumbers[i])
		{
			return i;
		}
	}
	return i;
}

// returns a pattern containing the indices for the intensity sequence (see documentation of getUniqueColor)
uvec3 getPattern( uint idIn )
{
	uint numIntensities = getFloorOfCubeRoot(idIn); //maximal number of different values needed to display idIn colors.
	uint index = idIn-((uint)pow(numIntensities,3)); //internal pattern index
	
	//case 1: all three values are the same in this pattern
	if (index == 0u) {
		return uvec3(numIntensities,numIntensities,numIntensities);
	}
	//preparation for case 2 and 3
	index= index - 1u; //since everything is shifted by one so white comes first
	//the three channels of the pattern vector
	uint channelIdxA = index % 3u;
	uint channelIdxB = (index+1u) % 3u;
	uint channelIdxC = (index+2u) % 3u;

	//case 2: there are only two values involved in this pattern
	if ((index / 3u) < numIntensities) {
		uvec3 pattern;
		uint valueA=(index / 3u)  % numIntensities;
		fillVectorAtIndex(pattern, channelIdxA, valueA);
		fillVectorAtIndex(pattern, channelIdxB, numIntensities);
		fillVectorAtIndex(pattern, channelIdxC, numIntensities);
		return pattern;
	}
	
	//case 3: three values involved in this pattern
	uvec3 pattern;
	fillVectorAtIndex(pattern, channelIdxA, ((index / 3u)-numIntensities) / numIntensities);
	fillVectorAtIndex(pattern, channelIdxB, ((index / 3u)-numIntensities) % numIntensities);
	fillVectorAtIndex(pattern, channelIdxC, numIntensities);
	return pattern;
}

//To get colors that are different from each other, we have to generate RGB patterns that have the maximal distance from each other.
//This does not mean they have to be visually different, since humans perceive colors a bit differently, but different in their RGB values.
//We assume the material, object and group IDs starts at zero. Every ID x that appears means that there have to be at least x colors.
//We can define a sequence of colors that starts with the maximal distance (black/white), then contains the primary colors, the mixtures between the primary colors, then the mixtures between the mixtures, and so on.
//If we index this sequence with the material/object/group ID, the low IDs get colors that are very different form each other and with rising ID, the colors get more and more similar.
//This algorithm, given an ID, creates the color that would appear in this sequence at that index.
//
//Each color has three channels. The channels contain the values of red, blue and green.
//We can generate many different colors with only a small set of different channel values, which are used in many different combinations.
//For example, our color sequence starts with:
//(255,255,255),
//(0,0,0),
//(255,0,0),
//(0,255,0),
//(0,0,255),
//(255,255,0),
//(0,255,255),
//(255,0,255).
//These are 8 colors, consisting of 2 different channel values in different combinations.
//We start with one value, 255, to create one possible color, white (255,255,255).
//Then we have to add a second value, 0. We now can list all f(n)=3*n^2+3*n+1 new variants of combining 0 and 255, thus enabling us to list f(0)+f(1)=1+7=8 colors.
//If we want to represent a ninth color, we need a third value.
//This value lies between 255 and 0, so 128. Having a third value results in f(2)=19 new combinations, for a total of 27 possible colors.
//The next values after 128 have to lie between the existing ones, so we have 64, 192, 32, 160, 96 and so on.
//Let's call this sequence the "sequence of intensities".
//The number of intensity values we need to generate enough colors for a given ID is the cube root of the ID.
//
//The algorithm now consists of two main steps.
//First, we generate a pattern that determines which intensities we have to use and returns indices on the sequence of intensities.
//Second, we determine the actual value for each of the three indices in the pattern and normalize it to [0.0,1.0].
vec3 getUniqueColor( uint idIn )
{
	uvec3 pattern = getPattern(idIn);
		return vec3 (
		getIntensity(pattern[0]),
		getIntensity(pattern[1]),
		getIntensity(pattern[2]) );
}


USE_BUFFER(uint, uMaterialIDs);
USE_BUFFER(uint, uObjectIDs);
USE_BUFFER(uint, uGroupIDs);

BEGIN_PARAMS
	INPUT0(vec3,fPosition)
	INPUT1(vec3,fTangent)
	INPUT2(vec3,fBitangent)
	INPUT3(vec3,fNormal)
	INPUT4(vec2,fTexCoord)
	INPUT5(vec3,fBakeDir)

	OUTPUT_COLOR0(vec4)
	OUTPUT_COLOR1(vec4)
	OUTPUT_COLOR2(vec4)
END_PARAMS
{
	OUT_COLOR0 = vec4( 0.0, 0.0, 0.0, 0.0 );
	OUT_COLOR1 = vec4( 0.0, 0.0, 0.0, 0.0 );
	OUT_COLOR2 = vec4( 0.0, 0.0, 0.0, 0.0 );

	vec3 traceDir = findTraceDirection( fPosition, normalize( fBakeDir ), fTexCoord );
	vec3 tracePos = findTraceOrigin( fPosition, traceDir, fTexCoord );

	TriangleHit hit;
	if( traceRay( tracePos, traceDir, hit ) )
	{
		uint id = uMaterialIDs[ hit.triangleIndex ];
		uint oid = uObjectIDs[ hit.triangleIndex ];
		uint gid = uGroupIDs[ hit.triangleIndex ];

		//output0: Mat, Obj, and Group ID
		OUT_COLOR0.rgb = getUniqueColor( id % MAX_NUMBER_OF_IDS ); //modulo necessary for getNumberOfIntensities
		OUT_COLOR0.a = 1.0;

		OUT_COLOR1.rgb = getUniqueColor( oid % MAX_NUMBER_OF_IDS ); //modulo necessary for getNumberOfIntensities
		OUT_COLOR1.a = 1.0;

		OUT_COLOR2.rgb = getUniqueColor( gid % MAX_NUMBER_OF_IDS ); //modulo necessary for getNumberOfIntensities
		OUT_COLOR2.a = 1.0;
	}
}
